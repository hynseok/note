import { create } from "zustand";

type SocialStore = {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
};

export const useSocial = create<SocialStore>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));
