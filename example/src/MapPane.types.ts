import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@kgtech-org/dira-maps-react-native';

import type { Palette } from './theme';

export interface MapPaneProps {
  coordinates: LatLng[];
  approximate: boolean;
  style: StyleProp<ViewStyle>;
  lineColor: string;
  /** La palette du thème courant — pour ce que le sample dessine lui-même. */
  palette: Palette;
  /** L'URL du style MapLibre du thème : ce que le volet vectoriel rend. */
  styleUrl: string;
}
