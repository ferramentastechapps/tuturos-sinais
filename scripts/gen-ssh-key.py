import os, sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PrivateFormat, PublicFormat, NoEncryption
    )
except ImportError:
    print("Instalando cryptography...")
    os.system(f"{sys.executable} -m pip install cryptography -q")
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PrivateFormat, PublicFormat, NoEncryption
    )

import base64, struct

ssh_dir = Path.home() / ".ssh"
ssh_dir.mkdir(exist_ok=True, mode=0o700)

priv_path = ssh_dir / "id_ed25519"
pub_path  = ssh_dir / "id_ed25519.pub"

if priv_path.exists():
    print(f"⚠️  Chave já existe: {priv_path}")
    print("Lendo chave pública existente...")
else:
    key = Ed25519PrivateKey.generate()

    # Private key (OpenSSH format)
    priv_pem = key.private_bytes(Encoding.PEM, PrivateFormat.OpenSSH, NoEncryption())
    priv_path.write_bytes(priv_pem)
    os.chmod(priv_path, 0o600)

    pub_key = key.public_key()
    raw_pub = pub_key.public_bytes(Encoding.Raw, PublicFormat.Raw)

    # Build OpenSSH public key format
    key_type = b"ssh-ed25519"
    def encode_bytes(b):
        return struct.pack(">I", len(b)) + b
    payload = encode_bytes(key_type) + encode_bytes(raw_pub)
    pub_b64 = base64.b64encode(payload).decode()
    pub_line = f"ssh-ed25519 {pub_b64} jotas-deploy\n"
    pub_path.write_text(pub_line)
    print(f"✅ Chave gerada: {priv_path}")

print(f"\n📋 Chave pública (copie para a VPS):\n")
print(pub_path.read_text().strip())
