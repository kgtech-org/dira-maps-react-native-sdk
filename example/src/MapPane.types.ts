import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@kgtech-org/dira-maps-react-native';

export interface MapPaneProps {
  coordinates: LatLng[];
  approximate: boolean;
  style: StyleProp<ViewStyle>;
  lineColor: string;
}
