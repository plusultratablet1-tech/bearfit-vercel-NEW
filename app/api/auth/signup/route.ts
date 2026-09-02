import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password, fullName, phone } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { error: signUpError.message || "Sign up failed" },
        { status: 400 }
      );
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const user = signUpData.user;

    const { error: memberError } = await supabase.from("members").upsert({
      id: user.id,
      user_id: user.id,
      email: user.email,
      full_name: fullName,
      phone: phone || null,
      status: "active",
      created_at: new Date().toISOString(),
    });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message || "Failed to create member profile" },
        { status: 500 }
      );
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        {
          error: signInError?.message || "Account created, but auto-login failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
      },
      message: "Account created successfully",
      redirectTo: "/member/dashboard",
    });
  } catch (error) {
    console.error("Signup error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
