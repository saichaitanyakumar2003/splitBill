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
    paddingTop: Platform.OS === 'ios' ? 65 : (Platform.OS === 'web' ? 20 : 50),
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

