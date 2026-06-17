import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Check, Crown, ExternalLink, RotateCw, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { fetchOrCreateProfile } from "@/api/profile";
import {
  Button,
  Card,
  PageHeader,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import {
  FALLBACK_PRICE,
  fetchOfferings,
  isLifetime,
  isPro,
  openManageSubscriptions,
  purchasePackage,
  restorePurchases,
  type Plan,
  type PlanPackages,
} from "@/features/subscription/subscription";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Subscription() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const session = useUserStore((s) => s.session);

  const [packages, setPackages] = useState<PlanPackages>({
    monthly: null,
    yearly: null,
    lifetime: null,
  });
  const [busy, setBusy] = useState<Plan | "restore" | null>(null);

  const pro = isPro(profile);
  const lifetime = isLifetime(profile);

  // Pull live offerings on mount so prices/intro offers reflect what App
  // Store Connect has approved — falls back gracefully when RC isn't yet
  // configured (no API key in .env) or there's no network.
  useEffect(() => {
    void fetchOfferings()
      .then((res) => setPackages(res.packages))
      .catch(() => {
        // Keep the null-package fallback UI; purchase taps surface their own error.
      });
  }, []);

  async function refreshProfile() {
    if (!session) return;
    const fresh = await fetchOrCreateProfile(session.user.id);
    if (fresh) setProfile(fresh);
  }

  async function handlePurchase(plan: Plan, pkg: PurchasesPackage | null) {
    if (busy) return;
    if (!pkg) {
      toast.error(t.subscription.offeringMissing);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(plan);
    const result = await purchasePackage(pkg);
    setBusy(null);
    if (result.ok) {
      toast.success(t.subscription.purchaseDone);
      // RevenueCat webhook updates profiles.tier on the server within seconds;
      // refresh now so the UI matches without waiting for the next poll.
      await refreshProfile();
    } else if ("cancelled" in result && result.cancelled) {
      // No toast — user dismissed the IAP sheet intentionally.
    } else {
      toast.error(t.subscription.checkoutFailed);
    }
  }

  async function handleRestore() {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy("restore");
    const result = await restorePurchases();
    setBusy(null);
    if (result.ok) {
      toast.success(t.subscription.restoreDone);
      await refreshProfile();
    } else if ("error" in result && result.error === "no_active_purchase") {
      toast.info(t.subscription.restoreNothing);
    } else {
      toast.error(t.subscription.restoreFailed);
    }
  }

  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString()
    : null;

  // Display price: prefer the localised RevenueCat string (with the right
  // currency for the user's storefront), fall back to USD constants.
  function priceFor(plan: Plan): string {
    const pkg = packages[plan];
    return pkg?.product.priceString ?? FALLBACK_PRICE[plan];
  }

  return (
    <Screen padded>
      <PageHeader
        title={t.subscription.openTitle}
        // Subscription lives under Profile, not Learn — override the
        // default library-section fallback.
        fallbackHref="/(app)/profile"
      />

      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing.md,
          gap: theme.spacing["2xl"],
          paddingBottom: theme.spacing["6xl"],
        }}
      >
        {/* Current state */}
        <Card
          bordered
          style={{
            borderColor: pro ? theme.colors.accent : theme.colors.border,
            backgroundColor: pro ? theme.colors.accentMuted : theme.colors.surface,
          }}
        >
          <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pro ? (
                <Crown color={theme.colors.accent} size={26} strokeWidth={2.2} />
              ) : (
                <Sparkles color={theme.colors.accent} size={26} strokeWidth={2.2} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color="tertiary">
                {t.subscription.currentPlanLabel}
              </Text>
              <Text variant="h3" color={pro ? "accent" : "primary"}>
                {lifetime
                  ? t.subscription.tierLifetime
                  : pro
                    ? t.subscription.tierPro
                    : t.subscription.tierFree}
              </Text>
              {profile?.status === "on_trial" ? (
                <Text variant="small" color="accent">
                  {t.subscription.onTrial}
                </Text>
              ) : profile?.status === "cancelled" && periodEnd ? (
                <Text variant="small" color="secondary">
                  {fmt(t.subscription.cancelledUntil, { date: periodEnd })}
                </Text>
              ) : pro && !lifetime && periodEnd ? (
                <Text variant="small" color="secondary">
                  {fmt(t.subscription.renewsOn, { date: periodEnd })}
                </Text>
              ) : (
                <Text variant="small" color="secondary">
                  {pro ? t.subscription.proHintShort : t.subscription.freeHintShort}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Pro perks */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" color="tertiary">
            {t.subscription.whyPro}
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            {[
              t.subscription.perk1,
              t.subscription.perk2,
              t.subscription.perk3,
              t.subscription.perk4,
              t.subscription.perk5,
            ].map((perk, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  gap: theme.spacing.sm,
                  alignItems: "flex-start",
                }}
              >
                <Check color={theme.colors.accent} size={18} strokeWidth={2.4} />
                <Text variant="body" style={{ flex: 1 }}>
                  {perk}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Plans */}
        {!lifetime ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="caption" color="tertiary">
              {pro ? t.subscription.changePlan : t.subscription.pickPlan}
            </Text>
            <PlanCard
              price={priceFor("yearly")}
              title={t.subscription.yearlyTitle}
              subtitle={t.subscription.yearlySubtitle}
              best
              loading={busy === "yearly"}
              onPress={() => handlePurchase("yearly", packages.yearly)}
            />
            <PlanCard
              price={priceFor("monthly")}
              title={t.subscription.monthlyTitle}
              subtitle={t.subscription.monthlySubtitle}
              loading={busy === "monthly"}
              onPress={() => handlePurchase("monthly", packages.monthly)}
            />
            <PlanCard
              price={priceFor("lifetime")}
              title={t.subscription.lifetimeTitle}
              subtitle={t.subscription.lifetimeSubtitle}
              loading={busy === "lifetime"}
              onPress={() => handlePurchase("lifetime", packages.lifetime)}
            />
          </View>
        ) : null}

        {/* Action row — restore is Apple-mandatory, manage opens the
            platform-native subscription page for cancellation. */}
        <View style={{ gap: theme.spacing.sm }}>
          {pro && !lifetime ? (
            <Button
              label={t.subscription.manageBilling}
              variant="secondary"
              fullWidth
              rightIcon={<ExternalLink color={theme.colors.textPrimary} size={16} strokeWidth={2} />}
              onPress={openManageSubscriptions}
            />
          ) : null}
          <Button
            label={t.subscription.restorePurchases}
            variant="ghost"
            fullWidth
            leftIcon={<RotateCw color={theme.colors.textPrimary} size={16} strokeWidth={2} />}
            onPress={handleRestore}
            loading={busy === "restore"}
          />
        </View>

        {/* Apple-compliant disclosure */}
        <Text
          variant="caption"
          color="tertiary"
          align="center"
          style={{ paddingHorizontal: theme.spacing.md }}
        >
          {Platform.OS === "ios"
            ? t.subscription.iosNotice
            : t.subscription.androidNotice}
        </Text>

        {/* Cross-promo back to the browser extension. Shown to anyone who
            already paid — that's the moment to remind them the same Pro
            unlocks the ChineseLens extension at zero extra cost. */}
        {pro ? (
          <Card bordered style={{ borderColor: theme.colors.border }}>
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="caption" color="tertiary">
                {t.subscription.crossPromoEyebrow}
              </Text>
              <Text variant="bodyStrong">{t.subscription.crossPromoTitle}</Text>
              <Text variant="small" color="secondary">
                {t.subscription.crossPromoBody}
              </Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PlanCard({
  price,
  title,
  subtitle,
  best,
  onPress,
  loading,
}: {
  price: string;
  title: string;
  subtitle: string;
  best?: boolean;
  onPress: () => void;
  loading?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: best ? theme.colors.accentMuted : theme.colors.surface,
        borderWidth: 1,
        borderColor: best ? theme.colors.accent : theme.colors.border,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <Text variant="bodyStrong">{title}</Text>
          {best ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: theme.radii.full,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Text variant="caption" color="onAccent">
                {t.subscription.bestValueRibbon}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color="secondary">
          {subtitle}
        </Text>
      </View>
      <Text variant="h3" color="accent">
        {price}
      </Text>
    </Pressable>
  );
}
