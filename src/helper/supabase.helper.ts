import { SupabaseClient } from '@supabase/supabase-js';

export async function getImageUrl(
  supabase: SupabaseClient,
  bucket_name: string,
  image_path: string,
) {
  const { data, error } = await supabase.storage
    .from(bucket_name)
    .createSignedUrl(image_path, 10 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
