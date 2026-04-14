export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  hours: string[];
  rating: number;
  user_ratings_total: number;
  website: string;
  url: string; // Google Maps URL
  reviews?: {
    author_name: string;
    profile_photo_url: string;
    rating: number;
    relative_time_description: string;
    text: string;
  }[];
}

export async function fetchPlaceDetails(placeId: string): Promise<BusinessInfo | null> {
  try {
    const response = await fetch(`/api/place-details/${placeId}`);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      const errorMessage = data.error_message || data.error || 'Failed to fetch place details';
      throw new Error(errorMessage);
    }

    const result = data.result;
    return {
      name: result.name,
      address: result.formatted_address,
      phone: result.formatted_phone_number,
      hours: result.opening_hours?.weekday_text || [],
      rating: result.rating,
      user_ratings_total: result.user_ratings_total,
      website: result.website,
      url: result.url,
      reviews: result.reviews
    };
  } catch (error) {
    console.error("Error fetching Google Place details:", error);
    return null;
  }
}
