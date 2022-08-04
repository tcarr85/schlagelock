import {
  Service,
  PlatformAccessory,
  CharacteristicEventTypes,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback
} from 'homebridge';
import internal from 'stream';

import { TommyPlatform } from './platform';

const request = require('request');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TommyPlatformAccessory {
  private service: Service;
  private state: Number

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private states = {
    Locked: this.platform.Characteristic.LockCurrentState.SECURED,
    Unlocked: this.platform.Characteristic.LockCurrentState.UNSECURED
  };

  constructor(
    private readonly platform: TommyPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // this.platform.log.info('Check new accessory:', accessory.context.device);

    this.state = this.states.Locked;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Wonderful-Tommy-Lock')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Lock service if it exists, otherwise create a new Lock service
    this.service = this.accessory.getService(this.platform.Service.LockMechanism) || this.accessory.addService(this.platform.Service.LockMechanism);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(1)
	  // this.service.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(1)
    // Default to lock state
    this.service.setCharacteristic(this.platform.Characteristic.LockCurrentState, this.states.Locked)
    this.service.setCharacteristic(this.platform.Characteristic.LockTargetState, this.states.Locked)
    // register handlers 
    this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)

      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        let state = (this.state) ? this.states.Locked : this.states.Unlocked;
        // this.platform.log.info(`Lock state for ${accessory.context.device.displayName} was returned: ` + this.state);
        this.getCurrentLockState(accessory.context.device)
        .then((result: any) =>{
          // this.platform.log.info(`Error`, err);
          // this.service.setCharacteristic(this.platform.Characteristic.LockCurrentState, value)
          // this.platform.log.info('get char Result', result);
          const {
            err,
            body
          } = result;

          this.platform.log.info('Yonomi API Result', result);

          if(err) {
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          }

          try {
            const data = JSON.parse(body).find((item) =>{
              return item.type_ref === '5b27f2622c26970013ee9ccd'
            });

            this.platform.log.info(`Door status from API for ${accessory.context.device.displayName} is ${data.value_human_readable}`);

            const val = (data.value_human_readable === 'Unlocked') ? 0 : 1;

            this.service.setCharacteristic(this.platform.Characteristic.LockCurrentState, val)

            callback(undefined, val);
          } catch {
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          }
        })
        .catch((err) => {
          this.platform.log.error(`Error`, err);
          throw new this.platform.api.hap.HapStatusError(err);
          // callback(err)
        })
        
        // callback(undefined, state);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.state = (value) ? this.states.Locked : this.states.Unlocked
        this.platform.log.info(`Set lock state for ${accessory.context.device.displayName}  to: ` + value);

        this.setLockTargetState(value, accessory.context.device)
        .then((result) =>{
          // this.platform.log.info(`Error`, err);
          this.service.setCharacteristic(this.platform.Characteristic.LockCurrentState, value)
        })
        .catch((err) => {
          this.platform.log.error(`Error`, err);
          throw new this.platform.api.hap.HapStatusError(err);
        })

        // this.service.setCharacteristic(this.platform.Characteristic.LockCurrentState, value)
        callback();
      });
  }

  getCurrentLockState(device) {
    let f = f => Promise.resolve(f).then(f)
    return new Promise((resolve, reject) => {
      function refresh() {}
      // this.platform.log.info('Device: ', device);
      // this.platform.log.info('Config: ', this.platform.config);

      const _self = this;

      const {
        token,
        deviceid
      } = device;

      const data = {
        "device_id": deviceid,
        "staterequest_id": [
          "5b27f2622c26970013ee9ccd"
        ]
      };

      request({
        url: 'https://api.yonomi.co/staterequests', 
        method: 'post',
        headers: {
          // "host": "api.yonomi.co",
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`,
          "x-request-key": "api", 
        },  
        body: JSON.stringify(data)
      }, (err, response, body) => {
          if(err) {
            this.platform.log.error(`Error`, err);
            reject(err);
          }

          request({
            url: `https://api.yonomi.co/devices/${deviceid}/states`, 
            method: 'get',
            headers: {
              // "host": "api.yonomi.co",
              "Content-Type": "application/json",
              "authorization": `Bearer ${token}`,
            },  
          }, (err, response, body) => {
              if(err) {
                _self.platform.log.error(`Error`, err);
                reject(err);
              }
              
              resolve({err, body})
            }
          );
        }
      );
    })
  }
  
  setLockTargetState(value, device) {
    return new Promise((resolve, reject) => {

      const{
        token,
        deviceid,
        unlockactionid,
        lockactionid
      } = device;

      let action = lockactionid; // make this lockActionId

      if(value === 1) {
        action = unlockactionid // Open
      }

      // this.platform.log.info('Device: ', device);
      // this.platform.log.info('Config: ', this.platform.config);


      
      const headers = {
        // "host": "api.yonomi.co",
        "Content-Type": "application/json",
        "accept": "*/*,",
        "authorization": `Bearer ${token}`,
        "accept-version": "v1.0.0",
        "client-id": this.platform.config.clientid,
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US;q=1",
        "chatset": "utf-8",
        "content-length": "91",
        "user-agent": "Yonomi/1.7.11 (iPhone; iOS 15.1.1)",
        "connection": "keep-alive",
        "x-request-key": "mobile-ios"
      };

      const body = {
        "params": {},
        "device_id": deviceid,
        "action_id": action
      };

       //this.platform.log.info('Headers: ', headers);
       //this.platform.log.info('Body: ', body);

      request({
        url: 'https://api.yonomi.co/actionrequests?async=false', 
        method: 'post',
        headers,
        body: JSON.stringify(body)
      }, (err, response, body) => {
          if(err) {
            this.platform.log.error(`Error`, err);
            reject(err);
          }
          resolve({err, body})
        }
      );
    })
  }

  

}