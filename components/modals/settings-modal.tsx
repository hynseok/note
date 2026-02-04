"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";

export const SettingsModal = () => {
    const settings = useSettings();

    return (
        <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
            <DialogContent>
                <DialogHeader className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 pb-3">
                    <DialogTitle className="text-lg font-medium">My settings</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-y-1">
                        <Label>Appearance</Label>
                        <span className="text-[0.8rem] text-muted-foreground">
                            Customize how Privatenote looks on your device
                        </span>
                    </div>
                    <ModeToggle />
                </div>
                <div className="flex items-center justify-between pt-4 border-t-[0.5px] border-neutral-200 dark:border-neutral-800">
                    <div className="flex flex-col gap-y-1">
                        <Label>Log out</Label>
                        <span className="text-[0.8rem] text-muted-foreground">
                            Log out of your account
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })} className="text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        Log out
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
