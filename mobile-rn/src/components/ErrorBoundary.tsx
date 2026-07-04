import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import { logger } from '../lib/logger';
import { spacing, typography } from '../shared/theme';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('crash', error.message, { stack: error.stack, info });
    logger.telemetry('uncaught_handler', { message: error.message });
  }

  render() {
    if (this.state.error) {
      const message = getFriendlyErrorMessage(this.state.error);
      return (
        <View style={styles.container} accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            Something went wrong
          </Text>
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
          <Button
            label="Try again"
            accessibilityHint="Dismisses the error and reloads this screen"
            onPress={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.subtitle,
  },
  message: {
    ...typography.body,
  },
});
