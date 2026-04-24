import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Users, 
  MapPin, 
  Clock, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
  GripVertical,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileDataCard, MobileDataList, MobileDataRow, MobileDataHeader } from '@/components/admin/MobileDataCard';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  is_available: boolean;
  average_rating: number;
}

interface Zone {
  id: string;
  name: string;
  multiplier: number;
}

interface Shift {
  id: string;
  driver_id: string;
  zone_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  drivers: Driver;
  zones: Zone;
}

interface DeploymentPrediction {
  hourlyRecommendations: {
    hour: number;
    displayTime: string;
    zones: {
      zoneId: string;
      zoneName: string;
      recommendedDrivers: number;
      urgency: string;
    }[];
  }[];
}

const TIME_SLOTS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
];

// --- Draggable Shift Card ---
function DraggableShiftCard({
  shift,
  statusColor,
  onDelete,
}: {
  shift: Shift;
  statusColor: string;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative rounded-lg border border-border/60 bg-accent/30 p-2.5 text-xs transition-all hover:bg-accent/60 hover:border-border hover:shadow-sm",
        isDragging && "opacity-30 ring-2 ring-primary"
      )}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(shift.id)}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/15"
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </button>

      {/* Driver name */}
      <p className="font-semibold text-foreground truncate px-5 text-[13px] leading-tight">
        {shift.drivers?.first_name} {shift.drivers?.last_name?.charAt(0)}.
      </p>

      {/* Zone */}
      <div className="flex items-center gap-1.5 text-muted-foreground mt-1.5">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate text-[11px]">{shift.zones?.name}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="text-[11px] font-medium text-foreground/80">
          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
        </span>
      </div>

      {/* Status pill at bottom */}
      <div className="mt-2">
        <Badge className={cn("text-[10px] px-2 py-0.5 rounded-md", statusColor)}>
          {shift.status}
        </Badge>
      </div>
    </div>
  );
}

// --- Droppable Day Column ---
function DroppableDayColumn({
  day,
  isToday,
  children,
}: {
  day: Date;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const dateStr = format(day, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card shadow-sm min-h-[220px] transition-all hover:shadow-md",
        isToday ? "border-primary/60 shadow-primary/10" : "border-border",
        isOver && "ring-2 ring-primary/50 bg-primary/5 border-primary/40"
      )}
    >
      {children}
    </div>
  );
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminScheduling() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    driver_id: '',
    zone_id: '',
    shift_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '16:00',
    notes: '',
  });
  const [filterDriverId, setFilterDriverId] = useState<string>('all');
  const [filterZoneId, setFilterZoneId] = useState<string>('all');
  const queryClient = useQueryClient();

  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['admin-drivers-scheduling'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, is_available, average_rating')
        .eq('is_active', true)
        .order('first_name');
      if (error) throw error;
      return data as Driver[];
    },
  });

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ['admin-zones-scheduling'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name, multiplier')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Zone[];
    },
  });

  // Fetch shifts for the week
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['admin-shifts', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_shifts')
        .select(`
          id, driver_id, zone_id, shift_date, start_time, end_time, status, notes,
          drivers:driver_id(id, first_name, last_name, is_available, average_rating),
          zones:zone_id(id, name, multiplier)
        `)
        .gte('shift_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('shift_date', format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
        .order('shift_date')
        .order('start_time');
      if (error) throw error;
      return data as unknown as Shift[];
    },
  });

  // Fetch predictions
  const { data: predictions } = useQuery({
    queryKey: ['driver-deployment-predictions-scheduling'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('predict-driver-deployment');
      if (error) throw error;
      return data as DeploymentPrediction;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async (shift: typeof newShift) => {
      const { error } = await supabase
        .from('driver_shifts')
        .insert([shift]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success(t.admin.shiftCreated);
      setIsCreateOpen(false);
      setNewShift({
        driver_id: '',
        zone_id: '',
        shift_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '16:00',
        notes: '',
      });
    },
    onError: (error) => {
      toast.error(t.admin.failedToCreateShift + ': ' + (error as Error).message);
    },
  });

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('driver_shifts')
        .delete()
        .eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success(t.admin.shiftDeleted);
    },
    onError: (error) => {
      toast.error(t.admin.failedToDeleteShift + ': ' + (error as Error).message);
    },
  });

  // Move shift mutation (drag-and-drop)
  const moveShiftMutation = useMutation({
    mutationFn: async ({ shiftId, newDate }: { shiftId: string; newDate: string }) => {
      const { error } = await supabase
        .from('driver_shifts')
        .update({ shift_date: newDate })
        .eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      toast.success(t.admin.shiftMoved);
    },
    onError: (error) => {
      toast.error(t.admin.failedToMoveShift + ': ' + (error as Error).message);
    },
  });

  // DnD state
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const shift = (event.active.data.current as any)?.shift as Shift;
    if (shift) setActiveShift(shift);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveShift(null);
    const { active, over } = event;
    if (!over) return;

    const shiftId = active.id as string;
    const newDate = (over.data.current as any)?.date as string;
    if (!newDate) return;

    // Find the shift being moved
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift || shift.shift_date === newDate) return;

    moveShiftMutation.mutate({ shiftId, newDate });
  };

  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => {
      if (!isSameDay(new Date(shift.shift_date), date)) return false;
      if (filterDriverId !== 'all' && shift.driver_id !== filterDriverId) return false;
      if (filterZoneId !== 'all' && shift.zone_id !== filterZoneId) return false;
      return true;
    });
  };

  const getRecommendationForZone = (zoneId: string, hour: number) => {
    const hourRec = predictions?.hourlyRecommendations.find(h => h.hour === hour);
    return hourRec?.zones.find(z => z.zoneId === zoneId);
  };

  const handleCreateShift = () => {
    if (!newShift.driver_id || !newShift.zone_id) {
      toast.error(t.admin.selectDriverAndZone);
      return;
    }
    createShiftMutation.mutate(newShift);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  };

  return (
    <AdminLayout
      title={t.admin.driverScheduling}
      description={t.admin.assignDriversToZones}
    >
      <div className="space-y-6">
        {/* Create Shift Button */}
        <div className="flex justify-end">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t.admin.createShift}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.admin.createNewShift}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t.admin.driver}</Label>
                  <Select
                    value={newShift.driver_id}
                    onValueChange={(v) => setNewShift({ ...newShift, driver_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectDriver} />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map(driver => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.first_name} {driver.last_name}
                          {driver.is_available && (
                            <Badge variant="outline" className="ml-2 text-xs">{t.status.available}</Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t.admin.zone}</Label>
                  <Select
                    value={newShift.zone_id}
                    onValueChange={(v) => setNewShift({ ...newShift, zone_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectZone} />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map(zone => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                          {zone.multiplier > 1 && (
                            <Badge variant="outline" className="ml-2 text-xs">{zone.multiplier}x</Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{(t as any).adminScheduling?.date || 'Date'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newShift.shift_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newShift.shift_date
                          ? format(new Date(newShift.shift_date + 'T00:00:00'), 'PPP')
                          : (t as any).adminScheduling?.pickADate || 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newShift.shift_date ? new Date(newShift.shift_date + 'T00:00:00') : undefined}
                        onSelect={(date) => date && setNewShift({ ...newShift, shift_date: format(date, 'yyyy-MM-dd') })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.startTime}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Clock className="mr-2 h-4 w-4" />
                          {TIME_SLOTS.find(s => s.value === newShift.start_time)?.label || newShift.start_time}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
                        <div className="flex items-center gap-2">
                          <Select
                            value={newShift.start_time.split(':')[0]}
                            onValueChange={(h) => setNewShift({ ...newShift, start_time: `${h}:${newShift.start_time.split(':')[1]}` })}
                          >
                            <SelectTrigger className="w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-lg font-semibold">:</span>
                          <Select
                            value={newShift.start_time.split(':')[1]}
                            onValueChange={(m) => setNewShift({ ...newShift, start_time: `${newShift.start_time.split(':')[0]}:${m}` })}
                          >
                            <SelectTrigger className="w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['00', '15', '30', '45'].map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.admin.endTime}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Clock className="mr-2 h-4 w-4" />
                          {TIME_SLOTS.find(s => s.value === newShift.end_time)?.label || newShift.end_time}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
                        <div className="flex items-center gap-2">
                          <Select
                            value={newShift.end_time.split(':')[0]}
                            onValueChange={(h) => setNewShift({ ...newShift, end_time: `${h}:${newShift.end_time.split(':')[1]}` })}
                          >
                            <SelectTrigger className="w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-lg font-semibold">:</span>
                          <Select
                            value={newShift.end_time.split(':')[1]}
                            onValueChange={(m) => setNewShift({ ...newShift, end_time: `${newShift.end_time.split(':')[0]}:${m}` })}
                          >
                            <SelectTrigger className="w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['00', '15', '30', '45'].map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.admin.notesOptional}</Label>
                  <Textarea
                    value={newShift.notes}
                    onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                    placeholder={t.common.notes + '...'}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateShift}
                  disabled={createShiftMutation.isPending}
                >
                  {createShiftMutation.isPending ? t.admin.creating : t.admin.createShift}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* AI Recommendations */}
        {predictions && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {t.admin.aiStaffingRecommendations}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {predictions.hourlyRecommendations.slice(0, 4).map(rec => (
                  <div key={rec.hour} className="rounded-lg border border-border bg-background p-3 text-sm">
                    <div className="font-medium text-foreground">{rec.displayTime}</div>
                    <div className="mt-1 space-y-1">
                      {rec.zones.slice(0, 2).map(zone => (
                        <div key={zone.zoneId} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {zone.zoneName}: {zone.recommendedDrivers} {t.admin.driversLabel}
                          {zone.urgency === 'critical' && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">{t.admin.urgent}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {format(weekStart, 'MMM d')} - {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">{(t as any).adminScheduling?.filter || 'Filter:'}</span>
          </div>
          <Select value={filterDriverId} onValueChange={setFilterDriverId}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder={(t as any).adminSchedulingExt?.allDriversPlaceholder || 'All Drivers'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.admin.allDrivers} ({shifts.length})</SelectItem>
              {drivers.map(driver => {
                const count = shifts.filter(s => s.driver_id === driver.id).length;
                return (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={filterZoneId} onValueChange={setFilterZoneId}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder={(t as any).adminSchedulingExt?.allZonesPlaceholder || 'All Zones'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.admin.allZones} ({shifts.length})</SelectItem>
              {zones.map(zone => {
                const count = shifts.filter(s => s.zone_id === zone.id).length;
                return (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {(filterDriverId !== 'all' || filterZoneId !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => { setFilterDriverId('all'); setFilterZoneId('all'); }}
            >
              {t.admin.clearFilters}
            </Button>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={shiftsLoading}
            loadingText={t.admin.loadingShifts}
            isEmpty={shifts.length === 0}
            emptyText={t.admin.noShiftsThisWeek}
          >
            {weekDays.map(day => {
              const dayShifts = getShiftsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              if (dayShifts.length === 0) return null;
              
              return (
                <div key={day.toISOString()} className="space-y-2">
                  <div className={cn(
                    "text-sm font-semibold px-1",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, 'EEEE, MMM d')}
                    {isToday && <span className="ml-2 text-xs font-normal">({(t as any).adminScheduling?.today || 'Today'})</span>}
                  </div>
                  {dayShifts.map(shift => (
                    <MobileDataCard key={shift.id}>
                      <MobileDataHeader
                        title={
                          <div className="flex items-center gap-2">
                            <span>{shift.drivers?.first_name} {shift.drivers?.last_name}</span>
                            <Badge className={cn("text-[10px]", STATUS_COLORS[shift.status as keyof typeof STATUS_COLORS])}>
                              {shift.status}
                            </Badge>
                          </div>
                        }
                        actions={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteShiftMutation.mutate(shift.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <MobileDataRow label={(t as any).adminScheduling?.zone || 'Zone'}>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {shift.zones?.name}
                        </div>
                      </MobileDataRow>
                      <MobileDataRow label={(t as any).adminScheduling?.time || 'Time'}>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                        </div>
                      </MobileDataRow>
                      {shift.notes && (
                        <MobileDataRow label={(t as any).adminScheduling?.notes || 'Notes'}>
                          <span className="text-muted-foreground">{shift.notes}</span>
                        </MobileDataRow>
                      )}
                    </MobileDataCard>
                  ))}
                </div>
              );
            })}
          </MobileDataList>
        </div>

        {/* Desktop Weekly Calendar Grid with Drag & Drop */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="hidden sm:grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {weekDays.map(day => {
              const dayShifts = getShiftsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <DroppableDayColumn key={day.toISOString()} day={day} isToday={isToday}>
                  {/* Day Header */}
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl",
                    isToday ? "bg-primary/10 border-primary/20" : "bg-muted/30 border-border"
                  )}>
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                      isToday
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Shifts Content */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {shiftsLoading ? (
                      <div className="flex items-center justify-center h-full py-6">
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : dayShifts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-6 gap-1">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground/40" />
                        <p className="text-[11px] text-muted-foreground/60">{t.admin.noShifts}</p>
                      </div>
                    ) : (
                      dayShifts.map(shift => {
                        const statusColor = STATUS_COLORS[shift.status as keyof typeof STATUS_COLORS] || '';
                        return (
                          <DraggableShiftCard
                            key={shift.id}
                            shift={shift}
                            statusColor={statusColor}
                            onDelete={(id) => deleteShiftMutation.mutate(id)}
                          />
                        );
                      })
                    )}
                  </div>
                </DroppableDayColumn>
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeShift ? (
              <div className="rounded-lg border border-primary bg-card p-2.5 text-xs shadow-xl opacity-90 w-[160px]">
                <p className="font-semibold text-foreground truncate text-[13px]">
                  {activeShift.drivers?.first_name} {activeShift.drivers?.last_name?.charAt(0)}.
                </p>
                <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate text-[11px]">{activeShift.zones?.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="text-[11px]">
                    {activeShift.start_time.slice(0, 5)} – {activeShift.end_time.slice(0, 5)}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{shifts.length}</p>
                <p className="text-sm text-muted-foreground">{t.admin.shiftsThisWeek}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <CalendarIcon className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {new Set(shifts.map(s => s.driver_id)).size}
                </p>
                <p className="text-sm text-muted-foreground">{t.admin.driversScheduled}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {new Set(shifts.map(s => s.zone_id)).size}
                </p>
                <p className="text-sm text-muted-foreground">{t.admin.zonesCovered}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
