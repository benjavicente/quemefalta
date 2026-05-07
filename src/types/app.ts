export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_public: boolean;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface StickerState {
  user_id: string;
  sticker_number: number;
  owned: boolean;
  dupes: number;
  note: string | null;
  updated_at: string;
}
