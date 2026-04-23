import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl mb-2">🇨🇳</Text>
        <Text className="text-3xl font-bold text-gray-900 mb-1">MandarinAI</Text>
        <Text className="text-base text-gray-500 mb-12">
          Learn Mandarin through conversation
        </Text>

        {sent ? (
          <View className="items-center">
            <Text className="text-6xl mb-4">✉️</Text>
            <Text className="text-xl font-semibold text-gray-800 mb-2">
              Check your email
            </Text>
            <Text className="text-gray-500 text-center">
              We sent a magic link to{"\n"}
              <Text className="font-medium text-gray-700">{email}</Text>
            </Text>
            <TouchableOpacity
              className="mt-8"
              onPress={() => setSent(false)}
            >
              <Text className="text-accent underline">Use a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="w-full">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email address
            </Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSendLink}
            />
            <TouchableOpacity
              className="w-full bg-accent rounded-xl py-4 items-center"
              onPress={handleSendLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Send magic link
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
