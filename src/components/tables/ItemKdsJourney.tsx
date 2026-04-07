import { format } from 'date-fns';
import { useKdsStationLogs } from '@/hooks/useKdsStationLogs';
import { useKdsStations } from '@/hooks/useKdsStations';

interface ItemKdsJourneyProps {
  orderItemId: string;
}

export function ItemKdsJourney({ orderItemId }: ItemKdsJourneyProps) {
  const { useItemLogs } = useKdsStationLogs();
  const { data: logs = [], isLoading } = useItemLogs(orderItemId);
  const { stations } = useKdsStations();

  if (isLoading) return null;

  // Filtrar apenas os logs de entrada (entered) para mostrar a jornada
  const entryLogs = logs.filter(log => log.action === 'entered');

  // Mapear station_id para nome/cor
  const journeySteps = entryLogs.map(log => {
    const station = stations.find(s => s.id === log.station_id);
    return {
      stationName: station?.name || 'Estação',
      stationColor: station?.color || '#888888',
      timestamp: format(new Date(log.created_at), 'HH:mm'),
    };
  });

  // Não mostrar se não houver jornada
  if (journeySteps.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-muted">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        📍 Jornada de Produção
      </p>
      <div className="space-y-1 pl-2">
        {journeySteps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="flex flex-col items-center">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: step.stationColor }}
              />
              {idx < journeySteps.length - 1 && (
                <div
                  className="w-0.5 h-3 mt-0.5"
                  style={{ backgroundColor: step.stationColor, opacity: 0.4 }}
                />
              )}
            </div>
            <span className="flex-1 text-foreground">{step.stationName}</span>
            <span className="text-muted-foreground font-mono">{step.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
