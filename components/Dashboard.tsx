// components/Dashboard.tsx

import React from 'react';
import useProfileData from '@/lib/useProfileData';  // Import the custom hook to fetch profile data

function Dashboard() {
  const userId = "89cb1b22-b510-4cf8-904b-b6be640708e2";  // Replace with actual user ID (this should come from authentication)
  const { profileData, error } = useProfileData(userId);  // Fetch data using the hook

  // Handle error state
  if (error) {
    return <div>Error: {error}</div>;  // If there's an error fetching data, display it
  }

  // Handle loading state
  if (!profileData) {
    return <div>Loading...</div>;  // If the data is still loading, show a loading message
  }

  // Render the profile data once it's fetched
  return (
    <div className="dashboard-data">
      <h2>Profile: {profileData.full_name}</h2>  {/* Display full name */}
      <p>Membership: {profileData.membership_id}</p>  {/* Display membership ID */}
      <p>Branch: {profileData.branch}</p>  {/* Display branch */}
      {/* Render more data here */}
    </div>
  );
}

export default Dashboard;
