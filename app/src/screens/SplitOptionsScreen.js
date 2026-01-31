import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const isAndroid = Platform.OS === 'android';

export default function SplitOptionsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Get bill data from route params (if coming from BillScan)
  const billData = route.params?.billData || null;

  // Redirect to Home on web page refresh (no navigation history)
  useEffect(() => {
    if (Platform.OS === 'web' && !isRedirecting) {
      // Check if this is a direct page access (refresh) by checking navigation state
      const state = navigation.getState();
      const hasHistory = state?.routes?.length > 1;
      
      if (!hasHistory) {
        setIsRedirecting(true);
        window.location.href = '/';
      }
    }
  }, [navigation, isRedirecting]);

  // Show loading while redirecting
  if (isRedirecting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FF6B35' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>Redirecting...</Text>
      </View>
    );
  }

  const handleBack = () => {
    // Check the navigation state to determine where to go
    const state = navigation.getState();
    const routes = state?.routes || [];
    const currentIndex = state?.index || 0;
    
    // If previous screen is CreateGroup or SelectGroup, go to Home instead
    if (currentIndex > 0) {
      const previousRoute = routes[currentIndex - 1];
      if (previousRoute?.name === 'CreateGroup' || previousRoute?.name === 'SelectGroup') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        return;
      }
    }
    
    // Otherwise normal back behavior
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const handleExistingGroup = () => {
    navigation.navigate('SelectGroup', { billData });
  };

  const handleCreateGroup = () => {
    navigation.navigate('CreateGroup', { billData });
  };

  // Android Layout - Orange header with white content area
  if (isAndroid) {
    return (
      <View style={androidStyles.container}>
        <StatusBar style="light" />
        
        {/* Orange Header */}
        <LinearGradient
          colors={['#F57C3A', '#E85A24', '#D84315']}
          style={androidStyles.headerGradient}
        >
          <View style={androidStyles.header}>
            <Pressable onPress={handleBack} style={androidStyles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#E85A24" />
            </Pressable>
            <Text style={androidStyles.headerTitle}>Split Options</Text>
            <View style={androidStyles.headerRight} />
          </View>
          
          {/* Decorative icon */}
          <View style={androidStyles.headerIconContainer}>
            <View style={androidStyles.headerIconCircle}>
              <Ionicons name="git-branch-outline" size={28} color="#E85A24" />
            </View>
          </View>
        </LinearGradient>

        {/* White Content Area with curved top */}
        <View style={androidStyles.contentWrapper}>
          <View style={androidStyles.content}>
            <Text style={androidStyles.cardTitle}>What would you like to do?</Text>
            <Text style={androidStyles.cardSubtitle}>Choose an option to split your expenses</Text>

            {/* Option 1: Existing Group */}
            <TouchableOpacity 
              style={androidStyles.optionCard}
              onPress={handleExistingGroup}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FFF8F5', '#FFFFFF']}
                style={androidStyles.optionGradient}
              >
                <View style={androidStyles.optionIconCircle}>
                  <Text style={androidStyles.optionEmoji}>📋</Text>
                </View>
                <View style={androidStyles.optionTextContainer}>
                  <Text style={androidStyles.optionTitle}>Existing Group</Text>
                  <Text style={androidStyles.optionSubtitle}>Add expense to a group</Text>
                </View>
                <View style={androidStyles.optionArrowCircle}>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Option 2: Create New Group */}
            <TouchableOpacity 
              style={androidStyles.optionCard}
              onPress={handleCreateGroup}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FFF8F5', '#FFFFFF']}
                style={androidStyles.optionGradient}
              >
                <View style={androidStyles.optionIconCircle}>
                  <Text style={androidStyles.optionEmoji}>✨</Text>
                </View>
                <View style={androidStyles.optionTextContainer}>
                  <Text style={androidStyles.optionTitle}>New Group</Text>
                  <Text style={androidStyles.optionSubtitle}>Create a fresh group</Text>
                </View>
                <View style={androidStyles.optionArrowCircle}>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Web/iOS Layout - Original design (unchanged from yesterday)
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8C5A', '#FF6B35', '#FF5722', '#E64A19']}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Split Options</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What would you like to do?</Text>

            {/* Option 1: Existing Group */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleExistingGroup}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>📋</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Add expense to existing group</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>

            {/* Option 2: Create New Group */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleCreateGroup}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>✨</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Create New Group</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// Web/iOS Styles - Original unchanged
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 65 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
  },
  backText: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 30,
    paddingVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionArrow: {
    fontSize: 28,
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 8,
  },
});

// Android Styles - New design
const androidStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E85A24',
  },
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerRight: {
    width: 44,
  },
  headerIconContainer: {
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 5,
    zIndex: 10,
  },
  headerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 35,
  },
  optionCard: {
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#E85A24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  optionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0D0',
  },
  optionIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E85A24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  optionArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E85A24',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
