import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Dumbbell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Workout {
  id: string;
  name: string;
  description: string | null;
}

interface AssignWithCustomizationProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AssignWithCustomization = ({
  clientId,
  clientName,
  open,
  onOpenChange,
  onSuccess,
}: AssignWithCustomizationProps) => {
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedWorkout, setSelectedWorkout] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchWorkouts();
    }
  }, [open]);

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkout) {
      toast({
        title: 'Ошибка',
        description: 'Выберите тренировку',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('workout_assignments')
        .insert({
          client_id: clientId,
          workout_id: selectedWorkout,
          due_date: dueDate || null,
          notes: notes.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({ title: 'Тренировка назначена' });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error assigning workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось назначить тренировку',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedWorkout('');
    setDueDate('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить тренировку</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Клиент: <span className="font-medium text-foreground">{clientName}</span>
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Нет доступных тренировок</p>
            </div>
          ) : (
            <>
              <div>
                <Label>Тренировка *</Label>
                <Select value={selectedWorkout} onValueChange={setSelectedWorkout}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тренировку" />
                  </SelectTrigger>
                  <SelectContent>
                    {workouts.map((workout) => (
                      <SelectItem key={workout.id} value={workout.id}>
                        {workout.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Выполнить до</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Заметки</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительные инструкции..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAssign}
                className="w-full"
                disabled={saving || !selectedWorkout}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Назначить
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
