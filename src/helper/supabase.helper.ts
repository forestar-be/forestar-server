import { SupabaseClient } from '@supabase/supabase-js';

export const notFoundImage =
  'https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png';

export async function getImageUrl(
  supabase: SupabaseClient,
  bucket_name: string,
  image_path: string,
) {
  const { data, error } = await supabase.storage
    .from(bucket_name)
    .createSignedUrl(image_path, 10 * 60);

  if (error) {
    if (
      error.name === 'StorageApiError' &&
      error.message.includes('not found')
    ) {
      return notFoundImage;
    }

    throw error;
  }

  return data.signedUrl;
}

export async function getImagePublicUrl(
  supabase: SupabaseClient,
  bucket_name: string,
  image_path: string,
) {
  const { data } = await supabase.storage
    .from(bucket_name)
    .getPublicUrl(image_path);

  return data.publicUrl;
}
