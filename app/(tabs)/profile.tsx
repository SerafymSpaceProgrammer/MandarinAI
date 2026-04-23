import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useUserStore } from "../../stores/userStore";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const { user, profile, signOut } = useUserStore();
  const [stats, setStats] = useState({ conversations: 0, vocab: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("vocab")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]).then(([conv, vocab]) => {
      setStats({
        conversations: conv.count ?? 0,
        vocab: vocab.count ?? 0,
      });
    });
  }, [user]);

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const hskLabels = ["", "HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Profile</Text>

        {/* User info */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wide mb-1">
            Email
          </Text>
          <Text className="text-gray-800 font-medium">{user?.email}</Text>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-gray-50 rounded-2xl p-5">
            <Text className="text-3xl font-bold text-accent">
              {stats.conversations}
            </Text>
            <Text className="text-gray-500 text-sm mt-1">Conversations</Text>
          </View>
          <View className="flex-1 bg-gray-50 rounded-2xl p-5">
            <Text className="text-3xl font-bold text-accent">
              {stats.vocab}
            </Text>
            <Text className="text-gray-500 text-sm mt-1">Vocab saved</Text>
          </View>
        </View>

        {/* HSK level */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-wide mb-1">
            Current Level
          </Text>
          <Text className="text-gray-800 font-medium">
            {hskLabels[profile?.hsk_level ?? 1]}
          </Text>
        </View>

        {/* Upgrade */}
        <TouchableOpacity
          className="bg-accent rounded-2xl p-5 mb-4 items-center"
          onPress={() =>
            Alert.alert("Coming soon", "Subscription will be powered by RevenueCat.")
          }
        >
          <Text className="text-white font-bold text-base">⭐ Upgrade to Pro</Text>
          <Text className="text-red-100 text-sm mt-1">
            Unlimited conversations · Offline mode
          </Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          className="border border-gray-200 rounded-2xl p-4 items-center"
          onPress={handleSignOut}
        >
          <Text className="text-gray-600 font-medium">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
