import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { transform, isObject, isArray, snakeCase } from 'lodash';
import { DiscoveryMethod, SimulatedCardType, DeviceType, DeviceStyle } from './definitions';
import { StripeTerminal } from './plugin-registration';
import { StripeTerminalWeb } from './web';
export class StripeTerminalError extends Error {
}
export class StripeTerminalPlugin {
    get activeSdkType() {
        if (this.selectedSdkType === 'js' &&
            this.stripeTerminalWeb !== undefined &&
            this.isNative()) {
            // only actually use the js sdk if its selected, initialized, and the app is running in a native environment
            return 'js';
        }
        else {
            return 'native';
        }
    }
    get sdk() {
        if (this.activeSdkType === 'js' && this.stripeTerminalWeb !== undefined) {
            return this.stripeTerminalWeb;
        }
        else {
            return StripeTerminal;
        }
    }
    /**
     * **_DO NOT USE THIS CONSTRUCTOR DIRECTLY._**
     *
     * Use the [[StripeTerminalPlugin.create]] method instead.
     * @hidden
     * @param options `StripeTerminalPlugin` options.
     */
    constructor(options) {
        this.isInitialized = false;
        this._fetchConnectionToken = () => Promise.reject('You must initialize StripeTerminalPlugin first.');
        this._onUnexpectedReaderDisconnect = () => {
            // reset the sdk type
            this.selectedSdkType = 'native';
            return Promise.reject('You must initialize StripeTerminalPlugin first.');
        };
        this.isDiscovering = false;
        this.isCollectingPaymentMethod = false;
        this.listeners = {};
        this.simulatedCardType = null;
        this.selectedSdkType = 'native';
        this._fetchConnectionToken = options.fetchConnectionToken;
        this._onUnexpectedReaderDisconnect = options.onUnexpectedReaderDisconnect;
    }
    isNative() {
        return (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
    }
    requestConnectionToken(sdkType) {
        const sdk = sdkType === 'native' ? StripeTerminal : this.stripeTerminalWeb;
        if (!sdk) {
            return;
        }
        this._fetchConnectionToken()
            .then(token => {
            if (token) {
                sdk.setConnectionToken({ token });
            }
            else {
                throw new Error('User-supplied `fetchConnectionToken` resolved successfully, but no token was returned.');
            }
        })
            .catch(err => {
            sdk.setConnectionToken(null, err.message || 'Error in user-supplied `fetchConnectionToken`.');
        });
    }
    async init() {
        var _a;
        if (this.isNative()) {
            // if on native android or ios, initialize the js sdk as well
            this.stripeTerminalWeb = new StripeTerminalWeb();
        }
        this.listeners['connectionTokenListenerNative'] =
            await StripeTerminal.addListener('requestConnectionToken', () => this.requestConnectionToken('native'));
        this.listeners['unexpectedReaderDisconnectListenerNative'] =
            await StripeTerminal.addListener('didReportUnexpectedReaderDisconnect', () => {
                this._onUnexpectedReaderDisconnect();
            });
        if (this.stripeTerminalWeb) {
            this.listeners['connectionTokenListenerJs'] =
                await this.stripeTerminalWeb.addListener('requestConnectionToken', () => this.requestConnectionToken('js'));
            this.listeners['unexpectedReaderDisconnectListenerJs'] =
                await this.stripeTerminalWeb.addListener('didReportUnexpectedReaderDisconnect', () => {
                    this._onUnexpectedReaderDisconnect();
                });
        }
        await Promise.all([
            StripeTerminal.initialize(),
            (_a = this.stripeTerminalWeb) === null || _a === void 0 ? void 0 : _a.initialize()
        ]);
        this.isInitialized = true;
    }
    translateAndroidReaderInput(data) {
        if (data.isAndroid) {
            const options = data.value.split('/').map((o) => o.trim());
            if (options.includes('Swipe') &&
                options.includes('Tap') &&
                options.includes('Insert')) {
                return 7;
            }
            else if (!options.includes('Swipe') &&
                options.includes('Tap') &&
                options.includes('Insert')) {
                return 6;
            }
            else if (options.includes('Swipe') &&
                options.includes('Tap') &&
                !options.includes('Insert')) {
                return 5;
            }
            else if (!options.includes('Swipe') &&
                options.includes('Tap') &&
                !options.includes('Insert')) {
                return 4;
            }
            else if (options.includes('Swipe') &&
                !options.includes('Tap') &&
                options.includes('Insert')) {
                return 3;
            }
            else if (!options.includes('Swipe') &&
                !options.includes('Tap') &&
                options.includes('Insert')) {
                return 2;
            }
            else if (options.includes('Swipe') &&
                !options.includes('Tap') &&
                !options.includes('Insert')) {
                return 1;
            }
            else {
                return 0;
            }
        }
        return parseFloat(data.value);
    }
    _listenerToObservable(name, transformFunc) {
        return new Observable(subscriber => {
            let listenerNative;
            let listenerJs;
            StripeTerminal.addListener(name, (data) => {
                // only send the event if the native sdk is in use
                if (this.activeSdkType === 'native') {
                    if (transformFunc) {
                        return subscriber.next(transformFunc(data));
                    }
                    return subscriber.next(data);
                }
            }).then(l => {
                listenerNative = l;
            });
            if (this.stripeTerminalWeb) {
                this.stripeTerminalWeb
                    .addListener(name, (data) => {
                    // only send the event if the js sdk is in use
                    if (this.activeSdkType === 'js') {
                        if (transformFunc) {
                            return subscriber.next(transformFunc(data));
                        }
                        return subscriber.next(data);
                    }
                })
                    .then(l => {
                    listenerJs = l;
                });
            }
            return {
                unsubscribe: () => {
                    listenerNative === null || listenerNative === void 0 ? void 0 : listenerNative.remove();
                    listenerJs === null || listenerJs === void 0 ? void 0 : listenerJs.remove();
                }
            };
        });
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('StripeTerminalPlugin must be initialized before you can use any methods.');
        }
    }
    /**
     * Ensure that an object exists and is not empty
     * @param object Object to check
     * @returns
     */
    objectExists(object) {
        if (Object.keys(object !== null && object !== void 0 ? object : {}).length) {
            return object;
        }
        return null;
    }
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
    static async create(options) {
        const terminal = new StripeTerminalPlugin(options);
        await terminal.init();
        return terminal;
    }
    async cancelDiscoverReaders() {
        var _a, _b, _c;
        try {
            (_a = this.listeners['readersDiscoveredNative']) === null || _a === void 0 ? void 0 : _a.remove();
            (_b = this.listeners['readersDiscoveredJs']) === null || _b === void 0 ? void 0 : _b.remove();
            if (!this.isDiscovering) {
                return;
            }
            await Promise.all([
                StripeTerminal.cancelDiscoverReaders(),
                (_c = this.stripeTerminalWeb) === null || _c === void 0 ? void 0 : _c.cancelDiscoverReaders()
            ]);
            this.isDiscovering = false;
        }
        catch (err) {
            // eat errors
        }
    }
    normalizeReader(reader) {
        if (reader.batteryLevel === 0) {
            // the only time that the battery level should be 0 is while scanning on Android and the level is unknown, so change it to null for consistency with iOS
            reader.batteryLevel = null;
        }
        if (reader.deviceSoftwareVersion === 'unknown') {
            // replace unknown with null to make Android consistent with iOS
            reader.deviceSoftwareVersion = null;
        }
        return reader;
    }
    snakeCaseRecursively(obj) {
        return transform(obj, (acc, value, key, target) => {
            const snakeKey = isArray(target) ? key : snakeCase(key);
            // don't touch metadata objects
            if (key === 'metadata') {
                acc[snakeKey] = value;
            }
            else {
                acc[snakeKey] = isObject(value)
                    ? this.snakeCaseRecursively(value)
                    : value;
            }
        });
    }
    parseJson(json) {
        const jsonObj = JSON.parse(json);
        return this.snakeCaseRecursively(jsonObj);
    }
    normalizePaymentIntent(paymentIntent) {
        if (!paymentIntent)
            return null;
        if (paymentIntent.amountDetails &&
            typeof paymentIntent.amountDetails === 'string') {
            paymentIntent.amountDetails = this.parseJson(paymentIntent.amountDetails);
        }
        if (paymentIntent.paymentMethod &&
            typeof paymentIntent.paymentMethod === 'string' &&
            !paymentIntent.paymentMethod.startsWith('pm_') // if its just the ID, return the ID
        ) {
            paymentIntent.paymentMethod = this.parseJson(paymentIntent.paymentMethod);
        }
        if (paymentIntent.charges) {
            paymentIntent.charges = paymentIntent.charges.map((charge) => {
                if (typeof charge === 'string') {
                    return this.parseJson(charge);
                }
                return charge;
            });
        }
        return paymentIntent;
    }
    discoverReaders(options) {
        this.ensureInitialized();
        return new Observable(subscriber => {
            let nativeReaderList = [];
            let jsReaderList = [];
            // reset the sdk type
            this.selectedSdkType = 'native';
            if (options.discoveryMethod === DiscoveryMethod.Internet) {
                this.selectedSdkType = 'js';
            }
            this.sdk
                .addListener('readersDiscovered', (event) => {
                var _a;
                const readers = ((_a = event === null || event === void 0 ? void 0 : event.readers) === null || _a === void 0 ? void 0 : _a.map(this.normalizeReader)) || [];
                nativeReaderList = readers;
                // combine the reader list with the latest reader list from the js sdk
                subscriber.next([...nativeReaderList, ...jsReaderList]);
            })
                .then(l => {
                this.listeners['readersDiscoveredNative'] = l;
            });
            const nativeOptions = Object.assign(Object.assign({}, options), { discoveryMethod: options.discoveryMethod === DiscoveryMethod.Both
                    ? DiscoveryMethod.BluetoothScan
                    : options.discoveryMethod });
            if (nativeOptions.discoveryMethod !== DiscoveryMethod.Internet) {
                // remove locationId if the native discovery method is not internet
                nativeOptions.locationId = undefined;
            }
            // start discovery
            this.isDiscovering = true;
            this.sdk
                .discoverReaders(nativeOptions)
                .then(() => {
                this.isDiscovering = false;
                subscriber.complete();
            })
                .catch((err) => {
                this.isDiscovering = false;
                subscriber.error(err);
            });
            // if using the both method, search with the js sdk as well
            if (options.discoveryMethod === DiscoveryMethod.Both &&
                this.stripeTerminalWeb) {
                this.stripeTerminalWeb
                    .addListener('readersDiscovered', (event) => {
                    var _a;
                    const readers = ((_a = event === null || event === void 0 ? void 0 : event.readers) === null || _a === void 0 ? void 0 : _a.map(this.normalizeReader)) || [];
                    jsReaderList = readers;
                    // combine the reader list with the latest reader list from the native sdk
                    subscriber.next([...nativeReaderList, ...jsReaderList]);
                })
                    .then(l => {
                    this.listeners['readersDiscoveredJs'] = l;
                });
                const jsOptions = Object.assign(Object.assign({}, options), { discoveryMethod: DiscoveryMethod.Internet // discovery method is always going to be internet for the js sdk, although, it really doesn't matter because it will be ignored anyway
                 });
                // TODO: figure out what to do with errors and completion on this method. maybe just ignore them?
                this.stripeTerminalWeb.discoverReaders(jsOptions);
            }
            return {
                unsubscribe: () => {
                    this.cancelDiscoverReaders();
                }
            };
        });
    }
    /**
     * Attempts to connect to the given bluetooth reader.
     *
     * @returns Reader
     */
    async connectBluetoothReader(reader, config) {
        this.ensureInitialized();
        // if connecting to an Bluetooth reader, make sure to switch to the native SDK
        this.selectedSdkType = 'native';
        const data = await this.sdk.connectBluetoothReader(Object.assign({ serialNumber: reader.serialNumber }, config));
        return this.objectExists(data === null || data === void 0 ? void 0 : data.reader);
    }
    /**
     * Attempts to connect to the given reader via usb.
     *
     * @returns Reader
     */
    async connectUsbReader(reader, config) {
        this.ensureInitialized();
        // if connecting to a USB reader, make sure to switch to the native SDK
        this.selectedSdkType = 'native';
        const data = await this.sdk.connectUsbReader({
            serialNumber: reader.serialNumber,
            locationId: config.locationId
        });
        return this.objectExists(data === null || data === void 0 ? void 0 : data.reader);
    }
    /**
     * Attempts to connect to the given reader in handoff mode.
     *
     * @returns Reader
     */
    async connectHandoffReader(reader, config) {
        this.ensureInitialized();
        // if connecting to a handoff reader, make sure to switch to the native SDK
        this.selectedSdkType = 'native';
        const data = await this.sdk.connectHandoffReader({
            serialNumber: reader.serialNumber,
            locationId: config.locationId
        });
        return this.objectExists(data === null || data === void 0 ? void 0 : data.reader);
    }
    /**
     * Attempts to connect to the local device's NFC reader.
     *
     * @returns Reader
     */
    async connectLocalMobileReader(reader, config) {
        this.ensureInitialized();
        // if connecting to a local reader, make sure to switch to the native SDK
        this.selectedSdkType = 'native';
        const data = await this.sdk.connectLocalMobileReader(Object.assign({ serialNumber: reader.serialNumber }, config));
        return this.objectExists(data === null || data === void 0 ? void 0 : data.reader);
    }
    /**
     * Attempts to connect to the given internet reader.
     *
     * @returns Reader
     */
    async connectInternetReader(reader, config) {
        var _a, _b;
        this.ensureInitialized();
        // if connecting to an internet reader, make sure to switch to the JS SDK
        this.selectedSdkType = 'js';
        const data = await this.sdk.connectInternetReader(Object.assign({ serialNumber: reader.serialNumber, ipAddress: (_a = reader.ipAddress) !== null && _a !== void 0 ? _a : undefined, stripeId: (_b = reader.stripeId) !== null && _b !== void 0 ? _b : undefined }, config));
        return this.objectExists(data === null || data === void 0 ? void 0 : data.reader);
    }
    /**
     * This is only here for backwards compatibility
     * @param reader
     * @returns Reader
     *
     * @deprecated
     */
    async connectReader(reader) {
        return await this.connectInternetReader(reader);
    }
    async getConnectedReader() {
        this.ensureInitialized();
        const data = await this.sdk.getConnectedReader();
        return data.reader;
    }
    async getConnectionStatus() {
        this.ensureInitialized();
        const data = await this.sdk.getConnectionStatus();
        return data === null || data === void 0 ? void 0 : data.status;
    }
    async getPaymentStatus() {
        this.ensureInitialized();
        const data = await this.sdk.getPaymentStatus();
        return data === null || data === void 0 ? void 0 : data.status;
    }
    async disconnectReader() {
        this.ensureInitialized();
        return await this.sdk.disconnectReader();
    }
    connectionStatus() {
        this.ensureInitialized();
        return new Observable(subscriber => {
            var _a;
            let hasSentEvent = false;
            // get current value
            this.getConnectionStatus()
                .then(data => {
                // only send the initial value if the event listener hasn't already
                if (!hasSentEvent) {
                    subscriber.next(data);
                }
            })
                .catch((err) => {
                subscriber.error(err);
            });
            let listenerNative;
            let listenerJs;
            // then listen for changes
            StripeTerminal.addListener('didChangeConnectionStatus', (data) => {
                // only send an event if we are currently on this sdk type
                if (this.activeSdkType === 'native') {
                    hasSentEvent = true;
                    subscriber.next(data === null || data === void 0 ? void 0 : data.status);
                }
            }).then(l => {
                listenerNative = l;
            });
            // then listen for js changes
            (_a = this.stripeTerminalWeb) === null || _a === void 0 ? void 0 : _a.addListener('didChangeConnectionStatus', (data) => {
                // only send an event if we are currently on this sdk type
                if (this.activeSdkType === 'js') {
                    hasSentEvent = true;
                    subscriber.next(data === null || data === void 0 ? void 0 : data.status);
                }
            }).then(l => {
                listenerJs = l;
            });
            return {
                unsubscribe: () => {
                    listenerNative === null || listenerNative === void 0 ? void 0 : listenerNative.remove();
                    listenerJs === null || listenerJs === void 0 ? void 0 : listenerJs.remove();
                }
            };
        });
    }
    async installAvailableUpdate() {
        this.ensureInitialized();
        return await this.sdk.installAvailableUpdate();
    }
    async cancelInstallUpdate() {
        this.ensureInitialized();
        return await this.sdk.cancelInstallUpdate();
    }
    didRequestReaderInput() {
        return this._listenerToObservable('didRequestReaderInput', (data) => {
            return this.translateAndroidReaderInput(data);
        });
    }
    didRequestReaderDisplayMessage() {
        return this._listenerToObservable('didRequestReaderDisplayMessage', (data) => {
            return parseFloat(data.value);
        });
    }
    didReportAvailableUpdate() {
        return this._listenerToObservable('didReportAvailableUpdate', (data) => {
            return this.objectExists(data === null || data === void 0 ? void 0 : data.update);
        });
    }
    didStartInstallingUpdate() {
        return this._listenerToObservable('didStartInstallingUpdate', (data) => {
            return this.objectExists(data === null || data === void 0 ? void 0 : data.update);
        });
    }
    didReportReaderSoftwareUpdateProgress() {
        return this._listenerToObservable('didReportReaderSoftwareUpdateProgress', (data) => {
            return parseFloat(data.progress);
        });
    }
    didFinishInstallingUpdate() {
        return this._listenerToObservable('didFinishInstallingUpdate', (data) => {
            return this.objectExists(data);
        });
    }
    async retrievePaymentIntent(clientSecret) {
        this.ensureInitialized();
        const data = await this.sdk.retrievePaymentIntent({ clientSecret });
        const pi = this.objectExists(data === null || data === void 0 ? void 0 : data.intent);
        return this.normalizePaymentIntent(pi);
    }
    async collectPaymentMethod(collectConfig) {
        if (this.isCollectingPaymentMethod) {
            return null;
        }
        this.isCollectingPaymentMethod = true;
        try {
            this.ensureInitialized();
            const data = await this.sdk.collectPaymentMethod(collectConfig);
            const pi = this.objectExists(data === null || data === void 0 ? void 0 : data.intent);
            return this.normalizePaymentIntent(pi);
        }
        catch (err) {
            throw err;
        }
        finally {
            this.isCollectingPaymentMethod = false;
        }
    }
    async cancelCollectPaymentMethod() {
        this.ensureInitialized();
        return await this.sdk.cancelCollectPaymentMethod();
    }
    async processPayment() {
        try {
            this.ensureInitialized();
            const data = await this.sdk.processPayment();
            const pi = this.objectExists(data === null || data === void 0 ? void 0 : data.intent);
            return this.normalizePaymentIntent(pi);
        }
        catch (err) {
            if (!(err === null || err === void 0 ? void 0 : err.message) || !(err === null || err === void 0 ? void 0 : err.data)) {
                throw err;
            }
            const stripeError = new StripeTerminalError(err.message);
            stripeError.decline_code = err.data.decline_code;
            stripeError.payment_intent = err.data.payment_intent;
            throw stripeError;
        }
    }
    async clearCachedCredentials() {
        this.ensureInitialized();
        return await this.sdk.clearCachedCredentials();
    }
    async setReaderDisplay(cart) {
        this.ensureInitialized();
        // ignore if the sdk is currently collecting a payment method
        if (this.isCollectingPaymentMethod) {
            return;
        }
        return await this.sdk.setReaderDisplay(cart);
    }
    async clearReaderDisplay() {
        this.ensureInitialized();
        // ignore if the sdk is currently collecting a payment method
        if (this.isCollectingPaymentMethod) {
            return;
        }
        return await this.sdk.clearReaderDisplay();
    }
    async listLocations(options) {
        this.ensureInitialized();
        const data = await this.sdk.listLocations(options);
        return data;
    }
    simulatedCardTypeStringToEnum(cardType) {
        // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
        const enumSimulatedCard = SimulatedCardType[cardType];
        return enumSimulatedCard;
    }
    async getSimulatorConfiguration() {
        this.ensureInitialized();
        const config = await this.sdk.getSimulatorConfiguration();
        if ((config === null || config === void 0 ? void 0 : config.simulatedCard) !== null && (config === null || config === void 0 ? void 0 : config.simulatedCard) !== undefined) {
            // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
            config.simulatedCard = this.simulatedCardTypeStringToEnum(config.simulatedCard);
            this.simulatedCardType = config.simulatedCard;
        }
        else if (this.simulatedCardType) {
            // use the stored simulated card type if it doesn't exist, probably because we are on android where you can't get it
            config.simulatedCard = this.simulatedCardType;
        }
        return this.objectExists(config);
    }
    async setSimulatorConfiguration(config) {
        this.ensureInitialized();
        const newConfig = await this.sdk.setSimulatorConfiguration(config);
        if (config === null || config === void 0 ? void 0 : config.simulatedCard) {
            // store the simulated card type because we can't get it from android
            this.simulatedCardType = config.simulatedCard;
        }
        if ((newConfig === null || newConfig === void 0 ? void 0 : newConfig.simulatedCard) !== null &&
            (newConfig === null || newConfig === void 0 ? void 0 : newConfig.simulatedCard) !== undefined) {
            // the simulated card type comes back as a string of the enum name so that needs to be converted back to an enum
            newConfig.simulatedCard = this.simulatedCardTypeStringToEnum(newConfig.simulatedCard);
        }
        else if (this.objectExists(newConfig)) {
            newConfig.simulatedCard = config.simulatedCard;
        }
        return this.objectExists(newConfig);
    }
    /**
     * The reader has lost Bluetooth connection to the SDK and reconnection attempts have been started.
     *
     * In your implementation of this method, you should notify your user that the reader disconnected and that reconnection attempts are being made.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didStartReaderReconnect() {
        return this._listenerToObservable('didStartReaderReconnect');
    }
    /**
     * The SDK was able to reconnect to the previously connected Bluetooth reader.
     *
     * In your implementation of this method, you should notify your user that reader connection has been re-established.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didSucceedReaderReconnect() {
        return this._listenerToObservable('didSucceedReaderReconnect');
    }
    /**
     * The SDK was not able to reconnect to the previously connected bluetooth reader. The SDK is now disconnected from any readers.
     *
     * In your implementation of this method, you should notify your user that the reader has disconnected.
     *
     * Requires `autoReconnectOnUnexpectedDisconnect` is set to true in the `BluetoothConnectionConfiguration`
     */
    didFailReaderReconnect() {
        return this._listenerToObservable('didFailReaderReconnect');
    }
    /**
     * Cancel auto-reconnection
     */
    async cancelAutoReconnect() {
        this.ensureInitialized();
        return await this.sdk.cancelAutoReconnect();
    }
    getDeviceStyleFromDeviceType(type) {
        return StripeTerminalPlugin.getDeviceStyleFromDeviceType(type);
    }
    static getDeviceStyleFromDeviceType(type) {
        if (type === DeviceType.Chipper2X ||
            type === DeviceType.StripeM2 ||
            type === DeviceType.WisePad3) {
            return DeviceStyle.Bluetooth;
        }
        else if (type === DeviceType.AppleBuiltIn) {
            return DeviceStyle.Local;
        }
        else if (type === DeviceType.WisePosE ||
            type === DeviceType.WisePosEDevKit ||
            type === DeviceType.StripeS700 ||
            type === DeviceType.VerifoneP400) {
            return DeviceStyle.Internet;
        }
        return DeviceStyle.Internet;
    }
    /**
     * @deprecated use requestPermissions and checkPermissions instead
     */
    static async getPermissions() {
        return await this.requestPermissions();
    }
    static async checkPermissions() {
        return await StripeTerminal.checkPermissions();
    }
    static async requestPermissions() {
        return await StripeTerminal.requestPermissions();
    }
    /**
     * This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
     *
     * @deprecated This should not be used directly. It will not behave correctly when using `Internet` and `Both` discovery methods
     */
    async addListener(eventName, listenerFunc) {
        return await this.sdk.addListener(eventName, listenerFunc);
    }
}
//# sourceMappingURL=plugin.js.map