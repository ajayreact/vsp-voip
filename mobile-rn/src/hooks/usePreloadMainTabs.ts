import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { MainTabParamList } from '../navigation/types';

const PRELOAD_TABS: (keyof MainTabParamList)[] = ['Contacts', 'Recent'];

/** Preloads primary tab stacks after Recent is interactive. */
export function usePreloadMainTabs(navigation: NavigationProp<ParamListBase> | undefined) {
  useEffect(() => {
    if (!navigation?.preload) return undefined;
    const handle = InteractionManager.runAfterInteractions(() => {
      for (const tab of PRELOAD_TABS) {
        navigation.preload(tab);
      }
    });
    return () => handle.cancel();
  }, [navigation]);
}
