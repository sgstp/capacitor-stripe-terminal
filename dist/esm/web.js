import { Subject } from 'rxjs';
import { WebPlugin } from '@capacitor/core';
import { ConnectionStatus, PaymentIntentStatus, PaymentStatus, DeviceType, ReaderNetworkStatus, BatteryStatus, LocationStatus, SimulatedCardType } from './definitions';
import { loadStripeTerminal } from '@stripe/terminal-js';
/**
 * @ignore
 */
const deviceTypes = {
    ['chipper_2X']: DeviceType.Chipper2X,
    ['verifone_P400']: DeviceType.VerifoneP400,
    ['bbpos_wisepos_e']: DeviceType.WisePosE,
    ['stripe_s700']: DeviceType.StripeS700
};
/**
 * @ignore
 */
const readerStatuses = {
    online: ReaderNetworkStatus.Online,
    offline: ReaderNetworkStatus.Offline
};
/**
 * @ignore
 */
const connectionStatus = {
    connecting: ConnectionStatus.Connecting,
    connected: ConnectionStatus.Connected,
    not_connected: ConnectionStatus.NotConnected
};
/**
 * @ignore
 */
const testPaymentMethodMap = {
    visa: SimulatedCardType.Visa,
    visa_debit: SimulatedCardType.VisaDebit,
    mastercard: SimulatedCardType.Mastercard,
    mastercard_debit: SimulatedCardType.MasterDebit,
    mastercard_prepaid: SimulatedCardType.MastercardPrepaid,
    amex: SimulatedCardType.Amex,
    amex2: SimulatedCardType.Amex2,
    discover: SimulatedCardType.Discover,
    discover2: SimulatedCardType.Discover2,
    diners: SimulatedCardType.Diners,
    diners_14digits: SimulatedCardType.Diners14Digit,
    jcb: SimulatedCardType.Jcb,
    unionpay: SimulatedCardType.UnionPay,
    interac: SimulatedCardType.Interac,
    charge_declined: SimulatedCardType.ChargeDeclined,
    charge_declined_insufficient_funds: SimulatedCardType.ChargeDeclinedInsufficientFunds,
    charge_declined_lost_card: SimulatedCardType.ChargeDeclinedLostCard,
    charge_declined_stolen_card: SimulatedCardType.ChargeDeclinedStolenCard,
    charge_declined_expired_card: SimulatedCardType.ChargeDeclinedExpiredCard,
    charge_declined_processing_error: SimulatedCardType.ChargeDeclinedProcessingError,
    refund_fail: SimulatedCardType.RefundFailed
};
/**
 * @ignore
 */
const paymentIntentStatus = {
    requires_payment_method: PaymentIntentStatus.RequiresPaymentMethod,
    requires_confirmation: PaymentIntentStatus.RequiresConfirmation,
    requires_capture: PaymentIntentStatus.RequiresCapture,
    processing: PaymentIntentStatus.Processing,
    canceled: PaymentIntentStatus.Canceled,
    succeeded: PaymentIntentStatus.Succeeded
};
/**
 * @ignore
 */
const paymentStatus = {
    not_ready: PaymentStatus.NotReady,
    ready: PaymentStatus.Ready,
    waiting_for_input: PaymentStatus.WaitingForInput,
    processing: PaymentStatus.Processing
};
/**
 * @ignore
 */
export class StripeTerminalWeb extends WebPlugin {
    constructor() {
        super();
        this.STRIPE_API_BASE = 'https://api.stripe.com';
        this.instance = null;
        this.simulated = false;
        this.currentClientSecret = null;
        this.currentPaymentIntent = null;
        this.currentConnectionToken = null;
        this.connectionTokenCompletionSubject = new Subject();
    }
    ensureInitialized() {
        if (!this.instance) {
            throw new Error('StripeTerminalPlugin must be initialized before you can use any methods.');
        }
        return this.instance;
    }
    async getPermissions() {
        return this.requestPermissions();
    }
    async checkPermissions() {
        // location permission isn't actually needed for the web version
        throw this.unimplemented('Permissions are not required on web.');
    }
    async requestPermissions() {
        // location permission isn't actually needed for the web version
        throw this.unimplemented('Permissions are not required on web.');
    }
    async setConnectionToken(options, errorMessage) {
        if (!(options === null || options === void 0 ? void 0 : options.token)) {
            return;
        }
        this.currentConnectionToken = options.token;
        this.connectionTokenCompletionSubject.next({
            token: options.token,
            errorMessage
        });
    }
    async initialize() {
        const ST = await loadStripeTerminal();
        if (!ST) {
            throw new Error('Terminal failed to load');
        }
        this.instance = ST.create({
            onFetchConnectionToken: async () => {
                return new Promise((resolve, reject) => {
                    this.notifyListeners('requestConnectionToken', null);
                    const sub = this.connectionTokenCompletionSubject.subscribe(({ token, errorMessage }) => {
                        if (errorMessage || !token) {
                            sub.unsubscribe();
                            return reject(new Error(errorMessage !== null && errorMessage !== void 0 ? errorMessage : 'No token found'));
                        }
                        return resolve(token);
                    });
                });
            },
            onUnexpectedReaderDisconnect: async () => {
                this.notifyListeners('didReportUnexpectedReaderDisconnect', {
                    reader: null
                });
            },
            onConnectionStatusChange: async (event) => {
                this.notifyListeners('didChangeConnectionStatus', {
                    status: connectionStatus[event.status]
                });
            },
            onPaymentStatusChange: async (event) => {
                this.notifyListeners('didChangePaymentStatus', {
                    status: event.status
                });
            }
        });
    }
    isInstanceOfLocation(object) {
        return typeof object === 'object' && 'id' in object;
    }
    translateReader(sdkReader) {
        var _a;
        return {
            stripeId: sdkReader.id,
            deviceType: deviceTypes[sdkReader.device_type],
            status: sdkReader.status
                ? readerStatuses[sdkReader.status]
                : ReaderNetworkStatus.Offline,
            serialNumber: sdkReader.serial_number,
            ipAddress: sdkReader.ip_address,
            locationId: this.isInstanceOfLocation(sdkReader.location)
                ? sdkReader.location.id
                : (_a = sdkReader.location) !== null && _a !== void 0 ? _a : null,
            label: sdkReader.label,
            deviceSoftwareVersion: sdkReader.device_sw_version,
            batteryStatus: BatteryStatus.Unknown,
            batteryLevel: null,
            isCharging: null,
            locationStatus: LocationStatus.Unknown,
            livemode: sdkReader.livemode,
            simulated: this.simulated
        };
    }
    async discoverReaders(options) {
        var _a;
        const sdk = this.ensureInitialized();
        this.simulated = !!options.simulated;
        const discoveryConfig = {
            simulated: options.simulated,
            location: options.locationId
        };
        const discoverResult = await sdk.discoverReaders(discoveryConfig);
        if (discoverResult.discoveredReaders) {
            const discover = discoverResult;
            const readers = (_a = discover === null || discover === void 0 ? void 0 : discover.discoveredReaders) === null || _a === void 0 ? void 0 : _a.map(this.translateReader.bind(this));
            this.notifyListeners('readersDiscovered', {
                readers
            });
        }
        else {
            const error = discoverResult;
            throw error.error;
        }
    }
    async cancelDiscoverReaders() { }
    async connectInternetReader(options) {
        var _a;
        const sdk = this.ensureInitialized();
        if (!options.stripeId) {
            throw new Error('Reader ID missing');
        }
        // use any here since we don't have all the reader details and don't actually need them all
        const readerOpts = {
            id: options.stripeId,
            object: 'terminal.reader',
            ip_address: (_a = options.ipAddress) !== null && _a !== void 0 ? _a : null,
            serial_number: options.serialNumber
        };
        const connectResult = await sdk.connectReader(readerOpts, {
            fail_if_in_use: options.failIfInUse
        });
        if (connectResult.reader) {
            const result = connectResult;
            const translatedReader = this.translateReader(result.reader);
            return { reader: translatedReader };
        }
        else {
            const error = connectResult;
            throw error.error;
        }
    }
    async connectBluetoothReader(_config) {
        // no equivalent
        console.warn('connectBluetoothReader is only available on iOS and Android.');
        return { reader: null };
    }
    async connectUsbReader(_config) {
        // no equivalent
        console.warn('connectUsbReader is only available on Android.');
        return { reader: null };
    }
    async connectLocalMobileReader(_config) {
        // no equivalent
        console.warn('connectLocalMobileReader is only available on iOS and Android.');
        return { reader: null };
    }
    async connectHandoffReader(_config) {
        // no equivalent
        console.warn('connectHandoffReader is only available on Android.');
        return { reader: null };
    }
    async getConnectedReader() {
        const sdk = this.ensureInitialized();
        const reader = sdk.getConnectedReader();
        if (!reader) {
            return { reader: null };
        }
        const translatedReader = this.translateReader(reader);
        return { reader: translatedReader };
    }
    async getConnectionStatus() {
        const sdk = this.ensureInitialized();
        const status = sdk.getConnectionStatus();
        return {
            status: connectionStatus[status]
        };
    }
    async getPaymentStatus() {
        const sdk = this.ensureInitialized();
        const status = sdk.getPaymentStatus();
        return {
            status: paymentStatus[status]
        };
    }
    async disconnectReader() {
        const sdk = this.ensureInitialized();
        await sdk.disconnectReader();
    }
    async installAvailableUpdate() {
        // no equivalent
        console.warn('installUpdate is only available for Bluetooth readers.');
    }
    async cancelInstallUpdate() {
        // no equivalent
        console.warn('cancelInstallUpdate is only available for Bluetooth readers.');
    }
    async retrievePaymentIntent(options) {
        var _a, _b, _c, _d;
        this.currentClientSecret = options.clientSecret;
        // make sure fetch is supported
        const isFetchSupported = 'fetch' in window;
        if (!isFetchSupported) {
            return {
                intent: null
            };
        }
        // parse the paymentIntentId out of the clientSecret
        const paymentIntentId = options.clientSecret
            ? options.clientSecret.split('_secret')[0]
            : null;
        const stripeUrl = new URL(`/v1/payment_intents/${paymentIntentId}`, this.STRIPE_API_BASE);
        stripeUrl.searchParams.append('client_secret', options.clientSecret);
        const response = await fetch(stripeUrl.href, {
            headers: {
                Authorization: `Bearer ${this.currentConnectionToken}`
            }
        });
        const json = await response.json();
        if (!response.ok) {
            throw new Error((_b = (_a = json === null || json === void 0 ? void 0 : json.error) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : json);
        }
        const paymentIntent = json;
        return {
            intent: {
                stripeId: paymentIntent.id,
                created: paymentIntent.created,
                status: paymentIntentStatus[paymentIntent.status],
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                paymentMethod: typeof paymentIntent.payment_method === 'string'
                    ? null
                    : paymentIntent.payment_method,
                amountDetails: paymentIntent.amount_details,
                charges: (_d = (_c = paymentIntent.charges) === null || _c === void 0 ? void 0 : _c.data) !== null && _d !== void 0 ? _d : [],
                metadata: paymentIntent.metadata
            }
        };
    }
    async collectPaymentMethod(collectConfig) {
        var _a, _b, _c;
        const sdk = this.ensureInitialized();
        if (!this.currentClientSecret) {
            throw new Error('No `clientSecret` was found. Make sure to run `retrievePaymentIntent` before running this method.');
        }
        const result = await sdk.collectPaymentMethod(this.currentClientSecret, {
            config_override: {
                update_payment_intent: collectConfig === null || collectConfig === void 0 ? void 0 : collectConfig.updatePaymentIntent,
                skip_tipping: collectConfig === null || collectConfig === void 0 ? void 0 : collectConfig.skipTipping,
                tipping: {
                    eligible_amount: (_a = collectConfig === null || collectConfig === void 0 ? void 0 : collectConfig.tipping) === null || _a === void 0 ? void 0 : _a.eligibleAmount
                }
            }
        });
        if (result.paymentIntent) {
            const res = result;
            this.currentPaymentIntent = res.paymentIntent;
            return {
                intent: {
                    stripeId: this.currentPaymentIntent.id,
                    created: this.currentPaymentIntent.created,
                    status: paymentIntentStatus[this.currentPaymentIntent.status],
                    amount: this.currentPaymentIntent.amount,
                    currency: this.currentPaymentIntent.currency,
                    paymentMethod: this.currentPaymentIntent
                        .payment_method,
                    amountDetails: this.currentPaymentIntent.amount_details,
                    charges: (_c = (_b = this.currentPaymentIntent.charges) === null || _b === void 0 ? void 0 : _b.data) !== null && _c !== void 0 ? _c : [],
                    metadata: this.currentPaymentIntent.metadata
                }
            };
        }
        else {
            const error = result;
            throw error.error;
        }
    }
    async cancelCollectPaymentMethod() {
        const sdk = this.ensureInitialized();
        await sdk.cancelCollectPaymentMethod();
    }
    async processPayment() {
        var _a, _b;
        const sdk = this.ensureInitialized();
        if (!this.currentPaymentIntent) {
            throw new Error('No `paymentIntent` was found. Make sure to run `collectPaymentMethod` before running this method.');
        }
        const result = await sdk.processPayment(this.currentPaymentIntent);
        if (result.paymentIntent) {
            const res = result;
            return {
                intent: {
                    stripeId: res.paymentIntent.id,
                    created: res.paymentIntent.created,
                    status: paymentIntentStatus[res.paymentIntent.status],
                    amount: res.paymentIntent.amount,
                    currency: res.paymentIntent.currency,
                    paymentMethod: res.paymentIntent
                        .payment_method,
                    amountDetails: res.paymentIntent.amount_details,
                    charges: (_b = (_a = res.paymentIntent.charges) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : [],
                    metadata: res.paymentIntent.metadata
                }
            };
        }
        else {
            const error = result;
            throw error === null || error === void 0 ? void 0 : error.error;
        }
    }
    async clearCachedCredentials() {
        const sdk = this.ensureInitialized();
        await sdk.clearCachedCredentials();
    }
    async setReaderDisplay(cart) {
        const sdk = this.ensureInitialized();
        const readerDisplay = {
            cart: {
                line_items: cart.lineItems.map(li => ({
                    amount: li.amount,
                    description: li.displayName,
                    quantity: li.quantity
                })),
                currency: cart.currency,
                tax: cart.tax,
                total: cart.total
            },
            type: 'cart'
        };
        await sdk.setReaderDisplay(readerDisplay);
    }
    async clearReaderDisplay() {
        const sdk = this.ensureInitialized();
        await sdk.clearReaderDisplay();
    }
    async listLocations(options) {
        // make sure fetch is supported
        const isFetchSupported = 'fetch' in window;
        if (!isFetchSupported) {
            throw new Error('fetch is not supported by this browser.');
        }
        const stripeUrl = new URL(`/v1/terminal/locations`, this.STRIPE_API_BASE);
        if (options === null || options === void 0 ? void 0 : options.limit) {
            stripeUrl.searchParams.append('limit', options.limit.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.endingBefore) {
            stripeUrl.searchParams.append('ending_before', options.endingBefore);
        }
        if (options === null || options === void 0 ? void 0 : options.startingAfter) {
            stripeUrl.searchParams.append('starting_after', options.startingAfter);
        }
        const response = await fetch(stripeUrl.href, {
            headers: {
                Authorization: `Bearer ${this.currentConnectionToken}`
            }
        });
        const json = await response.json();
        if (!response.ok) {
            throw new Error(json);
        }
        const locations = json.data.map((l) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                stripeId: l.id,
                displayName: l.display_name,
                livemode: l.livemode,
                address: {
                    city: (_a = l.address) === null || _a === void 0 ? void 0 : _a.city,
                    country: (_b = l.address) === null || _b === void 0 ? void 0 : _b.country,
                    line1: (_c = l.address) === null || _c === void 0 ? void 0 : _c.line1,
                    line2: (_d = l.address) === null || _d === void 0 ? void 0 : _d.line2,
                    postalCode: (_e = l.address) === null || _e === void 0 ? void 0 : _e.postal_code,
                    state: (_f = l.address) === null || _f === void 0 ? void 0 : _f.state
                }
            });
        });
        return {
            locations,
            hasMore: json.has_more
        };
    }
    async getSimulatorConfiguration() {
        const sdk = this.ensureInitialized();
        const config = sdk.getSimulatorConfiguration();
        return {
            simulatedCard: config.testPaymentMethod
                ? testPaymentMethodMap[config.testPaymentMethod]
                : undefined
        };
    }
    async setSimulatorConfiguration(config) {
        const sdk = this.ensureInitialized();
        let testPaymentMethod = null;
        for (const key in testPaymentMethodMap) {
            if (Object.prototype.hasOwnProperty.call(testPaymentMethodMap, key)) {
                const method = testPaymentMethodMap[key];
                if (method === config.simulatedCard) {
                    testPaymentMethod = key;
                }
            }
        }
        sdk.setSimulatorConfiguration({
            testPaymentMethod
        });
        return {
            simulatedCard: config.simulatedCard
        };
    }
    async cancelAutoReconnect() {
        // no equivalent
        console.warn('cancelAutoReconnect is only available for Bluetooth readers.');
    }
}
//# sourceMappingURL=web.js.map