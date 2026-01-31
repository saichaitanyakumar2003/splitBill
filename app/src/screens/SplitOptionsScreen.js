import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E85A24' }}>
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
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#E85A24" />
        </Pressable>
        <Text style={styles.headerTitle}>Split Options</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.cardTitle}>What would you like to do?</Text>

        {/* Option 1: Existing Group */}
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={handleExistingGroup}
          activeOpacity={0.8}
        >
          <View style={styles.optionIconCircle}>
            <Text style={styles.optionEmoji}>📋</Text>
          </View>
          <Text style={styles.optionTitle}>Add expense to existing group</Text>
          <View style={styles.optionArrowCircle}>
            <Ionicons name="chevron-forward" size={20} color="#E85A24" />
          </View>
        </TouchableOpacity>

        {/* Option 2: Create New Group */}
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={handleCreateGroup}
          activeOpacity={0.8}
        >
          <View style={styles.optionIconCircle}>
            <Text style={styles.optionEmoji}>✨</Text>
          </View>
          <Text style={styles.optionTitle}>Create New Group</Text>
          <View style={styles.optionArrowCircle}>
            <Ionicons name="chevron-forward" size={20} color="#E85A24" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 20 : 45),
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E85A24',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E85A24',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 30,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  optionIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E85A24',
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

