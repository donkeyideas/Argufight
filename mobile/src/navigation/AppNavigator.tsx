import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { MyProfileScreen } from '../screens/profile/MyProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { ConversationsScreen } from '../screens/messages/ConversationsScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { SupportScreen } from '../screens/support/SupportScreen';
import { UpgradeScreen } from '../screens/subscription/UpgradeScreen';
import { PrivacyScreen } from '../screens/legal/PrivacyScreen';
import { TermsScreen } from '../screens/legal/TermsScreen';
import { ChangePasswordScreen } from '../screens/settings/ChangePasswordScreen';
import { TwoFactorScreen } from '../screens/settings/TwoFactorScreen';
import { NotificationPrefsScreen } from '../screens/settings/NotificationPrefsScreen';
import { AboutScreen } from '../screens/legal/AboutScreen';
import { CreateTournamentScreen } from '../screens/tournaments/CreateTournamentScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {/* Modal screens — presented over tabs */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="MyProfile" component={MyProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ModalUserProfile" component={UserProfileScreen} />
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
