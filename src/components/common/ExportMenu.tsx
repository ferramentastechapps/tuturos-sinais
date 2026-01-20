import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportMenuProps {
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  onExportPDF?: () => void;
}

export const ExportMenu = ({ onExportCSV, onExportJSON, onExportPDF }: ExportMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportCSV && (
          <DropdownMenuItem onClick={onExportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar CSV
          </DropdownMenuItem>
        )}
        {onExportJSON && (
          <DropdownMenuItem onClick={onExportJSON}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar JSON
          </DropdownMenuItem>
        )}
        {onExportPDF && (
          <DropdownMenuItem onClick={onExportPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
