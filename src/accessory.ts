import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    CharacteristicValue,
    HAP,
    Logging,
    Service,
} from 'homebridge';

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module 
 * (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;
let homebridge: API;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    homebridge = api;
    hap = api.hap;
    api.registerAccessory('States', States);
};

class States implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;

    private readonly service: Service;
    private readonly informationService: Service;
    private readonly stateServices: Service[] = [];

    private readonly storage;

    constructor(log: Logging, config: AccessoryConfig) {
        this.log = log;
        this.name = config.name;

        const dir = homebridge.user.persistPath();
        this.storage = require('node-persist');
        this.storage.initSync({ dir: dir, forgiveParseErrors: true });
        const lastState = this.storage.getItemSync(this.name) || 0;

        this.service = new hap.Service.StatefulProgrammableSwitch(this.name, 'state');
        this.service.getCharacteristic(hap.Characteristic.ProgrammableSwitchOutputState)
            .setProps({ minValue: 0, maxValue: config.states.length - 1 })
            .onSet((value: CharacteristicValue) => {
                const i = value as number;
                this.storage.setItemSync(this.name, value);
                this.stateServices[i].getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).setValue(0);
            })
            .value = lastState;

        let i = 1;
        for (const state of config.states) {
            const s = new hap.Service.StatelessProgrammableSwitch(state, '' + i);
            s.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).setProps({ minValue: 0, maxValue: 0 });
            s.addOptionalCharacteristic(hap.Characteristic.ServiceLabelIndex);
            s.addOptionalCharacteristic(hap.Characteristic.Name);
            s.getCharacteristic(hap.Characteristic.ServiceLabelIndex).setValue(i++);
            s.getCharacteristic(hap.Characteristic.Name).setValue(state);
            this.stateServices.push(s);
        }

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'github.com/dubocr')
            .setCharacteristic(hap.Characteristic.SerialNumber, '000-001')
            .setCharacteristic(hap.Characteristic.Model, 'States');
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify(): void {
        this.log('Identify!');
    }

    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices(): Service[] {
        return [
            this.informationService,
            this.service,
        ].concat(this.stateServices.map((service) => service));
    }
}