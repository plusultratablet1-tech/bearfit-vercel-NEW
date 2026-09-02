import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { action, email, password, fullName, role } = await request.json();

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            avatar_initials: fullName
              .split(' ') // Split the full name by spaces
              .map((n: string) => n[0])  // Explicitly typing `n` as a string
              .join('')
              .toUpperCase()
              .slice(0, 4),  // Get the first 4 letters
          },
        },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ data });
    }
  } catch (err) {
    // Type assertion to Error type
    const error = err as Error;  // Assert that err is an instance of Error
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
