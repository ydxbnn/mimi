import { registerWebModule, NativeModule } from 'expo';

// FloatingMemoModule is not available on the web platform.
class FloatingMemoModule extends NativeModule<{}> {}

export default registerWebModule(FloatingMemoModule, 'FloatingMemoModule');
