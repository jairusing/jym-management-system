import { supabase } from '../../lib/supabase';
import { type ClassInput, type ClassItem, type ClassSession } from './classRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  trainer_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
};

type SessionRow = {
  id: string;
  class_id: string;
  scheduled_at: string;
  end_time: string;
  capacity: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  classes: { name: string } | { name: string }[] | null;
};

const classColumns = 'id, name, description, capacity, trainer_id, day_of_week, start_time, end_time, is_active, created_at';
const sessionColumns = 'id, class_id, scheduled_at, end_time, capacity, status, classes(name)';

function mapClass(row: ClassRow): ClassItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    trainerId: row.trainer_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

function mapSession(row: SessionRow): ClassSession {
  return {
    id: row.id,
    classId: row.class_id,
    className: (Array.isArray(row.classes) ? row.classes[0] : row.classes)?.name ?? 'Unknown class',
    scheduledAt: row.scheduled_at,
    endTime: row.end_time,
    capacity: row.capacity,
    status: row.status
  };
}

export class SupabaseClassRepository {
  async listClasses(): Promise<ClassItem[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('classes')
      .select(classColumns)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw new Error(`Failed to load classes: ${error.message}`);
    }

    return (data ?? []).map((row) => mapClass(row as ClassRow));
  }

  async createClass(input: ClassInput): Promise<ClassItem> {
    const client = ensureSupabase();

    if (!input.name.trim()) {
      throw new Error('Class name is required.');
    }
    if (input.endTime <= input.startTime) {
      throw new Error('End time must be after start time.');
    }

    const { data, error } = await client
      .from('classes')
      .insert({
        name: input.name.trim(),
        capacity: input.capacity,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime
      })
      .select(classColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create class: ${error?.message ?? 'unknown'}`);
    }

    return mapClass(data as ClassRow);
  }

  async deleteClass(id: string): Promise<void> {
    const client = ensureSupabase();

    const { error } = await client.from('classes').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete class: ${error.message}`);
    }
  }

  async listSessions(from: string, to: string): Promise<ClassSession[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('class_sessions')
      .select(sessionColumns)
      .gte('scheduled_at', from)
      .lt('scheduled_at', to)
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load sessions: ${error.message}`);
    }

    return (data ?? []).map((row) => mapSession(row as SessionRow));
  }

  async createSession(classId: string, scheduledAt: string): Promise<ClassSession> {
    const client = ensureSupabase();

    const { data: classData, error: classError } = await client
      .from('classes')
      .select('id, capacity, start_time, end_time, trainer_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      throw new Error(`Failed to load class for session: ${classError?.message ?? 'unknown'}`);
    }

    const startTime = classData.start_time.slice(0, 5);
    const scheduledIso = new Date(`${scheduledAt}T${startTime}+08:00`).toISOString();

    const { data, error } = await client
      .from('class_sessions')
      .insert({
        class_id: classId,
        scheduled_at: scheduledIso,
        end_time: classData.end_time,
        capacity: classData.capacity,
        trainer_id: classData.trainer_id
      })
      .select(sessionColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
    }

    return mapSession(data as SessionRow);
  }
}