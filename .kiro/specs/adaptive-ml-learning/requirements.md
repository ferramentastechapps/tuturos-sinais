# Documento de Requisitos

## Introdução

Esta feature transforma o Antigravity Kit de um sistema de roteamento estático baseado em keywords para um sistema de aprendizado adaptativo. O sistema atual seleciona agentes e skills por correspondência de palavras-chave fixas — sem memória de interações passadas e sem capacidade de melhorar com o tempo.

O objetivo é introduzir uma camada de Machine Learning que observa cada interação (qual agente foi selecionado, qual skill foi carregada, qual foi o resultado percebido), armazena esse histórico e usa esses dados para otimizar progressivamente as decisões de roteamento, seleção de skills e comportamento dos agentes.

---

## Glossário

- **Adaptive_Router**: Componente responsável por selecionar agentes e skills usando modelos de ML em vez de regras fixas de keywords.
- **Interaction_Logger**: Componente que registra cada interação do usuário com metadados relevantes (agente selecionado, skills carregadas, duração, feedback).
- **Feedback_Collector**: Componente que captura sinais de feedback explícito (avaliação do usuário) e implícito (rejeição de resposta, reformulação da pergunta).
- **ML_Model**: Modelo de machine learning treinado sobre o histórico de interações para prever a melhor combinação agente+skill para um dado contexto.
- **Interaction_Store**: Banco de dados local (SQLite) que persiste o histórico de interações e feedback.
- **Feature_Extractor**: Componente que transforma o texto de uma requisição em vetores de features para o ML_Model.
- **Routing_Score**: Pontuação numérica (0.0–1.0) que representa a confiança do ML_Model em uma combinação agente+skill para um dado contexto.
- **Fallback_Router**: Roteador baseado em keywords existente, usado quando o ML_Model não tem dados suficientes ou confiança abaixo do limiar.
- **Confidence_Threshold**: Valor mínimo de Routing_Score (padrão: 0.65) abaixo do qual o Adaptive_Router delega ao Fallback_Router.
- **Training_Pipeline**: Pipeline que re-treina o ML_Model periodicamente com novos dados do Interaction_Store.
- **Session**: Sequência de interações de um único usuário dentro de uma janela de tempo contínua.
- **Skill_Usage_Pattern**: Padrão estatístico que descreve com que frequência e em que contextos uma skill específica é carregada com sucesso.

---

## Requisitos

### Requisito 1: Registro de Interações

**User Story:** Como desenvolvedor usando o Antigravity Kit, quero que o sistema registre automaticamente cada interação, para que haja dados suficientes para treinar o modelo de aprendizado.

#### Critérios de Aceitação

1. WHEN uma requisição do usuário é processada pelo sistema, THE Interaction_Logger SHALL registrar no Interaction_Store: o texto da requisição, o agente selecionado, as skills carregadas, o timestamp e a duração do processamento.
2. WHEN o Interaction_Logger falha ao gravar no Interaction_Store, THE Interaction_Logger SHALL registrar o erro em um arquivo de log local e continuar o processamento da requisição sem interrupção.
3. THE Interaction_Store SHALL armazenar no mínimo 10.000 registros de interação sem degradação de performance de leitura acima de 50ms por consulta.
4. WHEN o Interaction_Store atinge 90% da capacidade configurada, THE Interaction_Logger SHALL emitir um alerta de capacidade e iniciar a remoção dos registros mais antigos com mais de 90 dias.

---

### Requisito 2: Coleta de Feedback

**User Story:** Como desenvolvedor, quero poder avaliar as respostas do sistema, para que o modelo aprenda quais roteamentos produziram resultados úteis.

#### Critérios de Aceitação

1. WHEN uma resposta é entregue ao usuário, THE Feedback_Collector SHALL disponibilizar um mecanismo de feedback explícito com escala de 1 a 5.
2. WHEN o usuário reformula a mesma pergunta dentro de 60 segundos após receber uma resposta, THE Feedback_Collector SHALL registrar um sinal de feedback implícito negativo (score: -1) para a interação anterior.
3. WHEN o usuário aceita e continua a conversa sem reformulação por mais de 120 segundos, THE Feedback_Collector SHALL registrar um sinal de feedback implícito positivo (score: +1) para a interação anterior.
4. IF o usuário não fornece feedback explícito, THEN THE Feedback_Collector SHALL usar exclusivamente sinais implícitos para atualizar o Interaction_Store.
5. THE Interaction_Store SHALL associar cada registro de interação a no máximo um score de feedback final, calculado como a média ponderada entre feedback explícito (peso 0.7) e implícito (peso 0.3).

---

### Requisito 3: Extração de Features

**User Story:** Como engenheiro de ML, quero que o texto das requisições seja transformado em representações numéricas, para que o modelo possa aprender padrões de forma eficiente.

#### Critérios de Aceitação

1. WHEN uma requisição é recebida, THE Feature_Extractor SHALL transformar o texto em um vetor de features dentro de 100ms.
2. THE Feature_Extractor SHALL extrair no mínimo as seguintes features: TF-IDF dos tokens da requisição, comprimento da requisição em tokens, hora do dia (normalizada 0–1), dia da semana (one-hot encoded) e histórico dos últimos 3 agentes selecionados na sessão atual.
3. THE Feature_Extractor SHALL normalizar todos os valores numéricos para o intervalo [0, 1] antes de passar ao ML_Model.
4. IF a requisição contém menos de 3 tokens após remoção de stopwords, THEN THE Feature_Extractor SHALL retornar um vetor de features com todos os valores em zero e sinalizar ao Adaptive_Router para usar o Fallback_Router.

---

### Requisito 4: Roteamento Adaptativo

**User Story:** Como usuário do Antigravity Kit, quero que o sistema selecione automaticamente o melhor agente e skills para minha tarefa com base em aprendizado, para que eu receba respostas mais precisas ao longo do tempo.

#### Critérios de Aceitação

1. WHEN uma requisição é recebida e o ML_Model possui mais de 50 interações registradas, THE Adaptive_Router SHALL usar o ML_Model para calcular o Routing_Score de cada combinação agente+skill disponível.
2. WHEN o Routing_Score mais alto calculado pelo ML_Model é maior ou igual ao Confidence_Threshold, THE Adaptive_Router SHALL selecionar a combinação agente+skill com maior Routing_Score.
3. WHEN o Routing_Score mais alto calculado pelo ML_Model é menor que o Confidence_Threshold, THE Adaptive_Router SHALL delegar a seleção ao Fallback_Router e registrar o evento como "baixa confiança" no Interaction_Store.
4. WHILE o Interaction_Store contém menos de 50 interações, THE Adaptive_Router SHALL usar exclusivamente o Fallback_Router para todas as requisições.
5. THE Adaptive_Router SHALL completar a seleção de agente+skill em no máximo 200ms, incluindo o tempo de inferência do ML_Model.
6. IF o agente selecionado pelo ML_Model não está disponível no momento da execução, THEN THE Adaptive_Router SHALL selecionar o agente com o segundo maior Routing_Score e registrar o fallback no Interaction_Store.

---

### Requisito 5: Treinamento do Modelo

**User Story:** Como administrador do sistema, quero que o modelo de ML seja re-treinado automaticamente com novos dados, para que o roteamento melhore continuamente sem intervenção manual.

#### Critérios de Aceitação

1. WHEN o Interaction_Store acumula 100 novos registros com feedback desde o último treinamento, THE Training_Pipeline SHALL iniciar automaticamente um ciclo de re-treinamento.
2. THE Training_Pipeline SHALL completar o re-treinamento em no máximo 5 minutos usando os dados disponíveis no Interaction_Store.
3. WHEN o re-treinamento é concluído, THE Training_Pipeline SHALL comparar a acurácia do novo modelo com o modelo atual usando um conjunto de validação de 20% dos dados mais recentes.
4. WHEN o novo modelo apresenta acurácia igual ou superior ao modelo atual no conjunto de validação, THE Training_Pipeline SHALL substituir o modelo atual pelo novo modelo.
5. IF o novo modelo apresenta acurácia inferior ao modelo atual, THEN THE Training_Pipeline SHALL descartar o novo modelo, manter o modelo atual e registrar o evento de regressão no log de treinamento.
6. THE Training_Pipeline SHALL serializar e persistir o modelo treinado no Interaction_Store com versionamento, mantendo os últimos 5 modelos para rollback.

---

### Requisito 6: Adaptação de Comportamento por Padrões de Uso

**User Story:** Como usuário frequente, quero que o sistema adapte o comportamento dos agentes com base nos meus padrões de uso, para que as respostas sejam progressivamente mais alinhadas ao meu contexto de trabalho.

#### Critérios de Aceitação

1. WHEN um usuário realiza mais de 20 interações com um agente específico, THE Adaptive_Router SHALL calcular o Skill_Usage_Pattern desse usuário para aquele agente e armazená-lo no Interaction_Store.
2. WHEN o Skill_Usage_Pattern de um usuário indica que uma skill específica é carregada em mais de 70% das interações com um agente, THE Adaptive_Router SHALL pré-carregar essa skill automaticamente nas próximas interações com aquele agente.
3. THE Adaptive_Router SHALL recalcular os Skill_Usage_Patterns de cada usuário a cada 24 horas ou após 10 novas interações, o que ocorrer primeiro.
4. WHERE o sistema opera em modo multi-usuário, THE Adaptive_Router SHALL manter Skill_Usage_Patterns isolados por identificador de usuário, sem compartilhamento de padrões entre usuários distintos.

---

### Requisito 7: Serialização e Persistência do Modelo

**User Story:** Como engenheiro de ML, quero que o modelo treinado seja serializado e carregado de forma confiável, para que o aprendizado não seja perdido entre sessões.

#### Critérios de Aceitação

1. THE ML_Model SHALL ser serializado em formato compatível com a biblioteca de ML utilizada (ex: pickle para scikit-learn, ONNX para modelos portáveis).
2. WHEN o sistema é inicializado, THE Adaptive_Router SHALL carregar o modelo serializado mais recente do Interaction_Store em no máximo 2 segundos.
3. THE ML_Model serializado e desserializado SHALL produzir Routing_Scores idênticos para o mesmo vetor de features de entrada (propriedade de round-trip: deserialize(serialize(model)).predict(x) == model.predict(x)).
4. IF o arquivo de modelo serializado está corrompido ou ausente durante a inicialização, THEN THE Adaptive_Router SHALL inicializar sem o ML_Model e operar exclusivamente com o Fallback_Router até que um novo modelo seja treinado.
5. THE Training_Pipeline SHALL versionar cada modelo serializado com timestamp e número de interações usadas no treinamento.

---

### Requisito 8: Observabilidade e Métricas

**User Story:** Como administrador do sistema, quero visualizar métricas de desempenho do roteamento adaptativo, para que eu possa monitorar a evolução do aprendizado e identificar regressões.

#### Critérios de Aceitação

1. THE Adaptive_Router SHALL expor as seguintes métricas em um arquivo de relatório JSON atualizado a cada hora: taxa de uso do ML_Model vs Fallback_Router, distribuição de Routing_Scores, acurácia média do modelo na última semana e número total de interações registradas.
2. WHEN a taxa de uso do Fallback_Router supera 40% das requisições nas últimas 24 horas, THE Adaptive_Router SHALL registrar um alerta no log de sistema indicando possível degradação do modelo.
3. THE Interaction_Store SHALL manter um histórico de acurácia por versão de modelo para permitir comparação temporal de desempenho.
4. WHEN solicitado via comando de administração, THE Training_Pipeline SHALL gerar um relatório de importância de features indicando quais features mais influenciam as decisões de roteamento.

