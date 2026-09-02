"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js"; // Import Supabase client

// Define types for the data
interface ProfileData {
  full_name: string;
  membership_id: string;
  branch: string;
}

interface MemberData {
  remaining_sessions: number;
  total_sessions: number;
}

interface PointsData {
  total_points: number;
  tier: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardData() {
  // Define state with proper types
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      const userId = "89cb1b22-b510-4cf8-904b-b6be640708e2"; // Alex's UID

      // Fetch Profile Data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (profileError) {
        setError(profileError.message);
      } else {
        setProfileData(profile as ProfileData);
      }

      // Fetch Member Data
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("id", userId)
        .single();
      if (memberError) {
        setError(memberError.message);
      } else {
        setMemberData(member as MemberData);
      }

      // Fetch Points Data
      const { data: points, error: pointsError } = await supabase
        .from("points")
        .select("*")
        .eq("member_id", userId)
        .single();
      if (pointsError) {
        setError(pointsError.message);
      } else {
        setPointsData(points as PointsData);
      }
    }

    fetchData();
  }, []);

  // Only render data once it's loaded
  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!profileData || !memberData || !pointsData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard-data">
      <h2>Profile: {profileData.full_name}</h2>
      <p>Membership: {profileData.membership_id}</p>
      <p>Branch: {profileData.branch}</p>
      <p>
        Sessions: {memberData.remaining_sessions}/{memberData.total_sessions}
      </p>
      <p>Points: {pointsData.total_points}</p>
      <p>Tier: {pointsData.tier}</p>
    </div>
  );
}
