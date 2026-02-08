"use client";

import { useEffect, useState } from "react";

export default function SinglePhotoPage() {
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhoto();
  }, []);

  const loadPhoto = async () => {
    try {
      setLoading(true);

      // The specific PK you want to display
      const targetPK = "MEDIA#1770524535876#658dc883fa9147";
      
      // Fetch from your section (adjust section name as needed)
const res = await fetch(`/api/slides?section=National+Anthems`);
      const data = await res.json();
      
      const items = data.items || [];
      
      // Find the specific photo by PK
      const photo = items.find((item: any) => item.PK === targetPK);
      
      if (photo?.url) {
        setPhotoUrl(photo.url);
      }

    } catch (err) {
      console.error("Failed to load photo:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Loading photo...
      </div>
    );
  }

  if (!photoUrl) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
        Photo not found
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <img
        src={photoUrl}
        alt="Photo"
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      />
    </div>
  );
}