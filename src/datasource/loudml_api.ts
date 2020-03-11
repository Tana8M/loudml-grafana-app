import { BackendSrv } from 'grafana/app/core/services/backend_srv';
// import { BackendSrv } from '@grafana/runtime';


export default class LoudMLAPI {
  private url: string;

  constructor(instanceSettings: any, private backendSrv: BackendSrv) {
    this.url = instanceSettings.url;
  }

  async get(url: string, params?: any) {
    return this._query('GET', url, params);
  }

  private async _query(method: string, url: string, data?: any) {
    method = method.toUpperCase();
    let options: any = {
      method,
      url: this.url + url
    };
    if(method === 'GET' || method === 'DELETE') {
      options.params = data;
    } else {
      options.data = data;
    }

    const response = await this.backendSrv.datasourceRequest(options);
    const responseData = response.data;

    return responseData;
  }
}