import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { authGet } from '../utils/apiHelper';
import WebPullToRefresh from '../components/WebPullToRefresh';

export default function SelectGroupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get billData if coming from scan/upload flow
  const billData = route.params?.billData || null;
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Detect mobile web
  const isMobileWeb = Platform.OS === 'web' && screenWidth < 768;
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Redirect to Home on web page refresh (no navigation history)
  useEffect(() => {
    if (Platform.OS === 'web' && !isRedirecting) {
      const state = navigation.getState();
      const hasHistory = state?.routes?.length > 1;
      
      if (!hasHistory) {
        setIsRedirecting(true);
        window.location.href = '/';
        return;
      }
    }
  }, [navigation, isRedirecting]);

  // Fetch user's groups (only active ones)
  const fetchGroups = async () => {
    try {
      const response = await authGet('/groups');
      const data = await response.json();
      if (Array.isArray(data)) {
        // Filter only active groups
        const activeGroups = data.filter(group => group.status === 'active');
        setGroups(activeGroups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, []);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const backAction = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [navigation]);

  const handleSelectGroup = (group) => {
    // Navigate to AddExpense screen with the selected group and billData if from scan
    navigation.navigate('AddExpense', {
      selectedGroup: {
        id: group._id || group.id,
        name: group.name,
      },
      billData: billData, // Pass billData if coming from scan/upload flow
    });
  };

  // Filter groups based on search query
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading while redirecting
  if (isRedirecting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FF6B35' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>Redirecting...</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Select Group</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.card}>
            {/* Card Header with Search */}
            <View style={styles.cardHeader}>
              <View style={styles.searchInputWrapper}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search active groups..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingText}>Loading groups...</Text>
              </View>
            ) : filteredGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No groups found' : 'No active groups'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery 
                    ? `No active groups matching "${searchQuery}"`
                    : 'Create a new group first to add expenses'
                  }
                </Text>
                {!searchQuery && (
                  <TouchableOpacity 
                    style={styles.createButton}
                    onPress={() => navigation.navigate('CreateGroup')}
                  >
                    <Text style={styles.createButtonText}>Create New Group</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : isMobileWeb ? (
              <WebPullToRefresh
                onRefresh={onRefresh}
                refreshing={refreshing}
                style={styles.groupsScrollView}
                contentContainerStyle={styles.groupsScrollContent}
                scrollViewProps={{
                  showsVerticalScrollIndicator: true,
                }}
              >
                <View style={styles.groupsList}>
                  {filteredGroups.map((group, index) => (
                    <TouchableOpacity
                      key={group._id || group.id}
                      style={[
                        styles.groupItem,
                        index < filteredGroups.length - 1 && styles.groupItemBorder
                      ]}
                      onPress={() => handleSelectGroup(group)}
                    >
                      <View style={styles.groupIcon}>
                        <Text style={styles.groupIconText}>
                          {group.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                        <Text style={styles.groupStatus}>● Active</Text>
                      </View>
                      <Text style={styles.groupArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </WebPullToRefresh>
            ) : (
              <ScrollView 
                style={styles.groupsScrollView}
                contentContainerStyle={styles.groupsScrollContent}
                showsVerticalScrollIndicator={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#FF6B35"
                    colors={['#FF6B35']}
                  />
                }
              >
                <View style={styles.groupsList}>
                  {filteredGroups.map((group, index) => (
                    <TouchableOpacity
                      key={group._id || group.id}
                      style={[
                        styles.groupItem,
                        index < filteredGroups.length - 1 && styles.groupItemBorder
                      ]}
                      onPress={() => handleSelectGroup(group)}
                    >
                      <View style={styles.groupIcon}>
                        <Text style={styles.groupIconText}>
                          {group.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                        <Text style={styles.groupStatus}>● Active</Text>
                      </View>
                      <Text style={styles.groupArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 0,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    padding: 5,
  },
  groupsScrollView: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  groupsScrollContent: {
    paddingBottom: 10,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  groupsList: {
    // No flex properties - let content determine natural height for proper scrolling
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  groupItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupStatus: {
    fontSize: 13,
    color: '#28A745',
    fontWeight: '500',
  },
  groupArrow: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: '300',
  },
});

