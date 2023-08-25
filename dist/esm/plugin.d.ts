import { PluginListenerHandle } from '@capacitor/core';
import { Observable } from 'rxjs';
import { Stripe } from 'stripe';
import { StripeTerminalConfig, DiscoveryConfiguration, InternetConnectionConfiguration, BluetoothConnectionConfiguration, UsbConnectionConfiguration, HandoffConnectionConfiguration, LocalMobileConnectionConfiguration, Reader, ConnectionStatus, PaymentStatus, ReaderDisplayMessage, ReaderInputOptions, PaymentIntent, Cart, ListLocationsParameters, SimulatorConfiguration, DeviceType, DeviceStyle, PermissionStatus, ReaderSoftwareUpdate, CollectConfig } from './definitions';
export declare class StripeTerminalError extends Error {
    /**
     * For card errors resulting from a card issuer decline, a short string indicating the [card issuer’s reason for the decline](https://stripe.com/docs/declines#issuer-declines) if they provide one.
     */
    decline_code?: string;
    /**
     * The `PaymentIntent` object for errors returned on a request involving a `PaymentIntent`.
     */
    payment_intent?: Stripe.PaymentIntent;
}
export declare class StripeTerminalPlugin {
    isInitialized: boolean;
    private stripeTerminalWeb?;
    private _fetchConnectionToken;
    private _onUnexpectedReaderDisconnect;
    private isDiscovering;
    private isCollectingPaymentMethod;
    private listeners;
    private simulatedCardType;
    private selectedSdkType;
    private get activeSdkType();
    private get sdk();
    /**
     * **_DO NOT USE THIS CONSTRUCTOR DIRECTLY._**
     *
     * Use the [[StripeTerminalPlugin.create]] method instead.
     * @hidden
     * @param options `StripeTerminalPlugin` options.
     */
    constructor(options: StripeTerminalConfig);
    private isNative;
    private requestConnectionToken;
    private init;
    private translateAndroidReaderInput;
    private _listenerToObservable;
    private ensureInitialized;
    /**
     * Ensure that an object exists and is not empty
     * @param object Object to check
     * @returns
     */
    private objectExists;
    /**
     * Creates an instance of [[StripeTerminalPlugin]] with the given options.
     *
     * ```typescript
     * const terminal = await StripeTerminalPlugin.create({
     *   fetchConnectionToken: async () => {
     *     const resp = await fetch('https://your-backend.dev/token', {
     *       method: 'POST'
     *     })
     *     const data = await resp.json()
     *
     *     return data.secret
     *   },
     *   onUnexpectedReaderDisconnect: () => {
     *     // handle reader disconnect
     *   }
     * })
     * ```
     *
     * @param options [[StripeTerminalPlugin]] options.
     */
    static create(options: StripeTerminalConfig): Promise<StripeTerminalPlugin>;
    cancelDiscoverReaders(): Promise<void>;
    private normalizeReader;
    private snakeCaseRecursively;
    private parseJson;
    private normalizePaymentIntent;
    discoverReaders(options: DiscoveryConfiguration): Observable<Reader[]>;
    /**
     * Attempts to connect to the given bluetooth reader.
     *
     * @returns Reader
     */
    connectBluetoothReader(reader: Reader, config: BluetoothConnectionConfiguration): Promise<Reader | null>;
    /**
     * Attempts to connect to the given reader via usb.
     *
     * @returns Reader
     */
    connectUsbReader(reader: Reader, config: UsbConnectionConfiguration): Promise<Reader | null>;
    /**
     * Attempts to connect to the given reader in handoff mode.
     *
     * @returns Reader
     */
    connectHandoffReader(reader: Reader, config: HandoffConnectionConfiguration): Promise<Reader | null>;
    /**
     * Attempts to connect to the local device's NFC reader.
     *
     * @returns Reader
     */
    connectLocalMobileReader(reader: Reader, config: LocalMobileConnectionConfiguration): Promise<Reader | null>;
    /**
     * Attempts to connect to the given internet reader.
     *
     * @returns Reader
     */
    connectInternetReader(reader: Reader, config?: InternetConnectionConfiguration): Promise<Reader | null>;
    /**
     * This is only here for backwards compatibility
     * @param reader
     * @returns Reader
     *
     * @deprecated
     */
    connectReader(reader: Reader): Promise<Reader | null>;
    getConnectedReader(): Promise<Reader | null>;
    getConnectionStatus(): Promise<ConnectionStatus>;
    getPaymentStatus(): Promise<PaymentStatus>;
    disconnectReader(): Promise<void>;
    connectionStatus(): Observable<ConnectionStatus>;
    installAvailableUpdate(): Promise<void>;
    cancelInstallUpdate(): Promise<void>;
    didRequestReaderInput(): Observable<ReaderInputOptions>;
    didRequestReaderDisplayMessage(): Observable<ReaderDisplayMessage>;
    didReportAvailableUpdate(): Observable<ReaderSoftwareUpdate>;
    didStartInstallingUpdate(): Observable<ReaderSoftwareUpdate>;
    didReportReaderSoftwareUpdateProgress(): Observable<number>;
    didFinishInstallingUpdate(): Observable<{
        update?: ReaderSoftwareUpdate;
        error?: string;
    }>;
    retrievePaymentIntent(clientSecret: string): Promise<PaymentIntent | null>;
    collectPaymentMethod(collectConfig?: CollectConfig): Promise<PaymentIntent | null>;
    cancelCollectPaymentMethod(): Promise<void>;
    processPayment(): Promise<PaymentIntent | null>;
    clearCachedCredentials(): Promise<void>;
    setReaderDisplay(cart: Cart): Promise<void>;
    clearReaderDisplay(): Promise<void>;
    listLocations(options?: ListLocationsParameters): Promise<{
        locations?: import("./definitions").Location[] | undefined;
        hasMore?: boolean | undefined;
    }>;
    private simulatedCardTypeStringToEnum;
    getSimulatorConfiguration(): Promise<SimulatorConfiguration | null>;
    setSimulatorConfiguration(config: SimulatorConfiguration): Promise<SimulatorConfiguration | null>;
    /**
     * The reader has lost Bluetooth connection to the SDK and reconnection attempts have been started.
     *
     * In your implementation of this method, you should notify your user that the reader disconnected and that reconnection attempts are being made.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didStartReaderReconnect(): Observable<void>;
    /**
     * The SDK was able to reconnect to the previously connected Bluetooth reader.
     *
     * In your implementation of this method, you should notify your user that reader connection has been re-established.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didSucceedReaderReconnect(): Observable<void>;
    /**
     * The SDK was not able to reconnect to the previously connected bluetooth reader. The SDK is now disconnected from any readers.
     *
     * In your implementation of this method, you should notify your user that the reader has disconnected.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didFailReaderReconnect(): Observable<void>;
    /**
     * Cancel auto-reconnection
     */
    cancelAutoReconnect(): Promise<void>;
    getDeviceStyleFromDeviceType(type: DeviceType): DeviceStyle;
    static getDeviceStyleFromDeviceType(type: DeviceType): DeviceStyle;
    /**
     * @deprecated use requestPermissions and checkPermissions instead
     */
    static getPermissions(): Promise<PermissionStatus>;
    static checkPermissions(): Promise<PermissionStatus>;
    static requestPermissions(): Promise<PermissionStatus>;
    /**
     * This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
     *
     * @deprecated This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
     */
    addListener(eventName: string, listenerFunc: Function): Promise<PluginListenerHandle>;
}
