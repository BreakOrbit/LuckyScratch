"use client";

import { useState } from "react";
import { BoltIcon, CheckCircleIcon, FingerPrintIcon, PhotoIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { notification } from "~~/utils/scaffold-eth";

type SettingsState = {
  nickname: string;
  broadcastWins: boolean;
  securityAlerts: boolean;
  terminalHints: boolean;
  autoLock: boolean;
};

const defaultSettings: SettingsState = {
  nickname: "0x71C...4f92",
  broadcastWins: true,
  securityAlerts: true,
  terminalHints: false,
  autoLock: true,
};
const isSameSettings = (left: SettingsState, right: SettingsState) =>
  left.nickname === right.nickname &&
  left.broadcastWins === right.broadcastWins &&
  left.securityAlerts === right.securityAlerts &&
  left.terminalHints === right.terminalHints &&
  left.autoLock === right.autoLock;

export function SettingsPanel() {
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [lastSavedAt, setLastSavedAt] = useState("Unsaved session");

  const isDirty = !isSameSettings(settings, savedSettings);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(current => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = () => {
    setSavedSettings(settings);
    setLastSavedAt(new Date().toLocaleString());
    notification.success("Settings saved.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-4">
            <div className="h-[2px] w-10 bg-ns-primary-container" />
            <span className="font-headline text-xs font-bold uppercase tracking-[0.3em] text-ns-primary-container">
              System Terminal
            </span>
          </div>
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-ns-on-surface md:text-5xl">
            TERMINAL SETTINGS
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-on-surface-variant">
            Converted from the profile settings terminal mockup and adapted to the current LuckyScratch profile shell.
          </p>
        </div>

        <div className="glass-panel rounded-xl border border-ns-outline-variant/10 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
            Sync Status
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-ns-tertiary">
            <CheckCircleIcon className="h-5 w-5" />
            {isDirty ? "Ready to save" : "All changes synced"}
          </div>
          <div className="mt-1 text-xs text-ns-on-surface-variant">Last update: {lastSavedAt}</div>
          <button
            type="button"
            disabled={!isDirty}
            onClick={handleSave}
            className="mt-3 w-full rounded-lg bg-ns-primary-container py-2 text-xs font-bold text-ns-on-primary transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Settings
          </button>
        </div>
      </div>

      <section className="glass-panel relative overflow-hidden rounded-2xl border border-ns-outline-variant/10 p-8">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-ns-primary-container/10 blur-3xl" />
        <div className="grid gap-10 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-52 rounded-full bg-gradient-to-br from-ns-primary-container via-ns-primary to-ns-secondary p-1 shadow-[0_0_40px_rgba(255,215,0,0.2)]">
                <img
                  alt="User avatar preview"
                  className="aspect-square w-full rounded-full object-cover grayscale transition duration-700 hover:grayscale-0"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuArrF605MJVk9CXZ76IUTL3MtTgpVDFkQHFOpucpjy0sFSkLli3b_wp7F-22MmEWGNlslT9YCIkEUrj-GfzuP9LgIjFDPD3Lxiv6os2bahovXDC0qJ-Do927z4hSQh6s4kyREYZISxMf_I1gLklvN7W3dIZkqd_-uYRVwdLmnxBbIgpFmrs69oQV8aD6m9pUFsanWtNOaN_ZXEn39KatZboneNprrkjvDQIP__5ec56JD2a2aT2MSGMVJb33Rsuq6YKRKBHmEUMNi9t"
                />
              </div>
              <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-ns-primary-container/20 blur-3xl" />
            </div>

            <button className="btn border-ns-primary-container/30 bg-ns-surface-container-highest px-6 text-xs font-black uppercase tracking-[0.2em] text-ns-primary-container hover:border-ns-primary-container hover:bg-ns-primary-container hover:text-ns-on-primary">
              <PhotoIcon className="h-5 w-5" />
              Upload New Avatar
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <UserCircleIcon className="h-6 w-6 text-ns-primary-container" />
                <h2 className="font-headline text-xl font-bold tracking-wide text-ns-on-surface">
                  AVATAR CUSTOMIZATION
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-ns-on-surface-variant">
                Your terminal identity appears in winner broadcasts, creator activity feeds, and leaderboard highlights.
                Keep it cinematic, but still wallet recognizable.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-low p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ns-on-surface-variant">
                  Display Layer
                </div>
                <div className="mt-2 font-headline text-lg font-bold text-ns-on-surface">Vault Signature</div>
              </div>
              <div className="rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-low p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ns-on-surface-variant">
                  Broadcast Status
                </div>
                <div className="mt-2 font-headline text-lg font-bold text-ns-tertiary">Priority Ready</div>
              </div>
              <div className="rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-low p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ns-on-surface-variant">
                  Sync Channel
                </div>
                <div className="mt-2 font-headline text-lg font-bold text-ns-secondary">PROFILE_V2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="glass-panel rounded-2xl border border-ns-outline-variant/10 p-8">
          <div className="mb-8 flex items-center gap-3">
            <FingerPrintIcon className="h-6 w-6 text-ns-secondary" />
            <h2 className="font-headline text-xl font-bold tracking-wide text-ns-on-surface">USER IDENTITY</h2>
          </div>

          <label className="mb-3 block text-xs font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
            Nickname
          </label>
          <div className="group relative">
            <input
              value={settings.nickname}
              onChange={event => updateSetting("nickname", event.target.value)}
              className="w-full rounded-xl border border-ns-outline-variant/20 bg-ns-surface-container-lowest px-5 py-4 font-headline text-lg text-ns-on-surface outline-none transition-colors placeholder:text-ns-on-surface-variant/30 focus:border-ns-tertiary"
              placeholder="Set your broadcast name"
              type="text"
            />
            <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-ns-tertiary transition-all duration-500 group-focus-within:w-full" />
          </div>
          <p className="mt-3 text-xs italic text-ns-on-surface-variant">
            This nickname appears on the leaderboard, winner feed, and creator spotlight cards.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-low p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
                Network
              </div>
              <div className="mt-2 font-headline text-sm font-bold text-ns-on-surface">MAINNET_AETHER_V4</div>
            </div>
            <div className="rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-low p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
                Encryption
              </div>
              <div className="mt-2 font-headline text-sm font-bold text-ns-on-surface">QUANTUM-SHIELD-AES256</div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-ns-outline-variant/10 p-8">
          <div className="mb-8 flex items-center gap-3">
            <BoltIcon className="h-6 w-6 text-ns-tertiary" />
            <h2 className="font-headline text-xl font-bold tracking-wide text-ns-on-surface">SECURITY STATE</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-ns-tertiary/20 bg-ns-tertiary/5 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
                Wallet Session
              </div>
              <div className="mt-2 text-lg font-bold text-ns-tertiary">Verified</div>
              <div className="mt-1 text-xs text-ns-on-surface-variant">
                Relayer and vault terminal signatures aligned.
              </div>
            </div>
            <div className="rounded-xl border border-ns-primary-container/20 bg-ns-primary-container/5 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ns-on-surface-variant">
                Claim Protection
              </div>
              <div className="mt-2 text-lg font-bold text-ns-primary-container">High</div>
              <div className="mt-1 text-xs text-ns-on-surface-variant">
                Reward claim confirmations require signed reveal context.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
