"use client";

import { useParams } from "next/navigation";
import { EditProfileForm } from "@/components/edit-profile-form";

export default function EditProfilePage() {
  const params = useParams();
  const username = params.username as string;
  return <EditProfileForm username={username} />;
}
