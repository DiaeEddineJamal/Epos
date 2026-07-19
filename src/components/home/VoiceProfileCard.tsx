import React from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import darkArtwork from "../../assets/epos-voice-profile-dark.webp";
import lightArtwork from "../../assets/epos-voice-profile-light.webp";
import { voiceProfileFor } from "../../utils/voiceProfile";

interface VoiceProfileCardProps {
  totalWords: number;
}

/**
 * "Voice Profile" plaque — an accomplishment badge earned by lifetime dictated
 * words. The profile name and rank advance as the user dictates more, with a
 * meter toward the next tier. Rendered in the institutional Lumon idiom.
 */
export const VoiceProfileCard: React.FC<VoiceProfileCardProps> = ({
  totalWords,
}) => {
  const { t, i18n } = useTranslation();
  const profile = voiceProfileFor(totalWords);
  const name = t(`home.voiceProfile.tiers.${profile.tier.id}`);
  const nf = new Intl.NumberFormat(i18n.language);

  return (
    <div className="voice-profile-card glass-panel relative isolate overflow-hidden rounded-sm">
      <div
        className="voice-profile-art is-light"
        style={{ backgroundImage: `url(${lightArtwork})` }}
        aria-hidden
      />
      <div
        className="voice-profile-art is-dark"
        style={{ backgroundImage: `url(${darkArtwork})` }}
        aria-hidden
      />
      <div className="voice-profile-shade" aria-hidden />

      <div className="relative z-[1] flex flex-col gap-3.5 p-5">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="shrink-0 flex h-12 w-12 items-center justify-center rounded-sm border hairline bg-[color-mix(in_srgb,var(--color-surface),transparent_18%)] backdrop-blur-[2px]"
          >
            <AudioLines size={22} strokeWidth={1.5} className="text-live" />
          </div>
          <div className="min-w-0 flex flex-1 flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/55">
                {t("home.voiceProfile.title")}
              </p>
              <span className="font-mono text-[10px] tabular-nums text-text/50">
                {profile.index}/{profile.total}
              </span>
            </div>
            <p className="text-[16px] font-medium text-text truncate">{name}</p>
          </div>
        </div>

        {/* Progress toward the next tier */}
        <div className="flex flex-col gap-1.5">
          <div
            className="h-1 w-full bg-hairline rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(profile.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="block h-full bg-live transition-[width] duration-700 ease-lumon"
              style={{ width: `${profile.progress * 100}%` }}
            />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text/55">
            {profile.next
              ? t("home.voiceProfile.toNext", {
                  count: profile.toNext,
                  countFmt: nf.format(profile.toNext),
                  tier: t(`home.voiceProfile.tiers.${profile.next.id}`),
                })
              : t("home.voiceProfile.maxed")}
          </p>
        </div>
      </div>
    </div>
  );
};
