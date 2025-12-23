import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, Language } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

export default function LanguageSelection() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  const handleContinue = () => {
    if (selectedLanguage) {
      router.push({
        pathname: '/translate',
        params: { languageCode: selectedLanguage.code, languageName: selectedLanguage.name }
      });
    }
  };

  return (
    <LinearGradient
      colors={['#DCD6F7', '#D0F4DE', '#A9DEF9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
        <View className="flex-1 pt-16 pb-8 px-6">
          {/* Header */}
          <View className="mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/50 items-center justify-center mb-6"
            >
              <Feather name="arrow-left" size={24} color="#4A4E69" />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-pastel-text mb-2">
              Select Language
            </Text>
            <Text className="text-base text-pastel-text-light">
              Which language would you like to translate to?
            </Text>
          </View>

          {/* Language Grid */}
          <ScrollView
            className="flex-1 mb-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="gap-3">
              {SUPPORTED_LANGUAGES.map((language) => {
                const isSelected = selectedLanguage?.code === language.code;
                return (
                  <TouchableOpacity
                    key={language.code}
                    onPress={() => setSelectedLanguage(language)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderRadius: 24,
                      borderWidth: 1,
                      backgroundColor: isSelected ? '#fff' : 'rgba(255,255,255,0.4)',
                      borderColor: isSelected ? '#DCD6F7' : 'rgba(255,255,255,0.2)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                        backgroundColor: isSelected ? '#D0F4DE' : 'rgba(255,255,255,0.6)',
                      }}>
                        <Text style={{ fontSize: 24 }}>{language.flag}</Text>
                      </View>
                      <View>
                        <Text style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: isSelected ? '#4A4E69' : 'rgba(74,78,105,0.8)',
                        }}>
                          {language.name}
                        </Text>
                        <Text style={{
                          fontSize: 14,
                          color: isSelected ? '#9A8C98' : 'rgba(154,140,152,0.8)',
                        }}>
                          {language.nativeName}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={{
                        backgroundColor: '#DCD6F7',
                        borderRadius: 12,
                        padding: 4,
                        marginRight: 8,
                      }}>
                        <Feather name="check" size={16} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Continue Button */}
          {selectedLanguage && (
            <TouchableOpacity
              onPress={handleContinue}
              style={{ width: '100%', borderRadius: 24, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#4A4E69', '#2D2F40']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 20 }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
                  Continue
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
    </LinearGradient>
  );
}