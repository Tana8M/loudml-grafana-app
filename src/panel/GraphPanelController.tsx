import React from 'react';
import moment from 'moment'

import { GraphSeriesToggler, Button, Tooltip } from '@grafana/ui';
import { PanelData, GraphSeriesXY, AbsoluteTimeRange, TimeZone, AppEvents } from '@grafana/data';
import { getDataSourceSrv, getBackendSrv } from '@grafana/runtime';
import appEvents from 'grafana/app/core/app_events';

import { getGraphSeriesModel } from './getGraphSeriesModel';
import { Options, SeriesOptions } from './types';
import { SeriesColorChangeHandler, SeriesAxisToggleHandler } from '@grafana/ui/src/components/Graph/GraphWithLegend';

import LoudMLDatasource from '../datasource/datasource';
import {
  DEFAULT_LOUDML_RP,
  MODEL_TYPE_LIST,
  DEFAULT_MODEL,
  DEFAULT_FEATURE,
  DEFAULT_START_OPTIONS,
  MIN_INTERVAL_SECOND,
  MIN_INTERVAL_UNIT,
  MAX_INTERVAL_SECOND,
  MAX_INTERVAL_UNIT,
  MIN_SPAN,
  MAX_SPAN,
  DEFAULT_ANOMALY_TYPE,
  ANOMALY_HOOK_NAME,
  ANOMALY_HOOK
} from '../datasource/types';


interface GraphPanelControllerAPI {
  series: GraphSeriesXY[];
  onSeriesAxisToggle: SeriesAxisToggleHandler;
  onSeriesColorChange: SeriesColorChangeHandler;
  onSeriesToggle: (label: string, event: React.MouseEvent<HTMLElement>) => void;
  onToggleSort: (sortBy: string) => void;
  onHorizontalRegionSelected: (from: number, to: number) => void;
}

interface GraphPanelControllerProps {
  children: (api: GraphPanelControllerAPI) => JSX.Element;
  options: Options;
  data: PanelData;
  timeZone: TimeZone;
  onOptionsChange: (options: Options) => void;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

interface GraphPanelControllerState {
  graphSeriesModel: GraphSeriesXY[];
}

export class GraphPanelController extends React.Component<GraphPanelControllerProps, GraphPanelControllerState> {
  constructor(props: GraphPanelControllerProps) {
    super(props);

    this.onSeriesColorChange = this.onSeriesColorChange.bind(this);
    this.onSeriesAxisToggle = this.onSeriesAxisToggle.bind(this);
    this.onToggleSort = this.onToggleSort.bind(this);
    this.onHorizontalRegionSelected = this.onHorizontalRegionSelected.bind(this);

    this.state = {
      graphSeriesModel: getGraphSeriesModel(
        props.data.series,
        props.timeZone,
        props.options.series,
        props.options.graph,
        props.options.legend,
        props.options.fieldOptions
      ),
    };
  }

  static getDerivedStateFromProps(props: GraphPanelControllerProps, state: GraphPanelControllerState) {
    return {
      ...state,
      graphSeriesModel: getGraphSeriesModel(
        props.data.series,
        props.timeZone,
        props.options.series,
        props.options.graph,
        props.options.legend,
        props.options.fieldOptions
      ),
    };
  }

  onSeriesOptionsUpdate(label: string, optionsUpdate: SeriesOptions) {
    const { onOptionsChange, options } = this.props;
    const updatedSeriesOptions: { [label: string]: SeriesOptions } = { ...options.series };
    updatedSeriesOptions[label] = optionsUpdate;
    onOptionsChange({
      ...options,
      series: updatedSeriesOptions,
    });
  }

  onSeriesAxisToggle(label: string, yAxis: number) {
    const {
      options: { series },
    } = this.props;
    const seriesOptionsUpdate: SeriesOptions = series[label]
      ? {
          ...series[label],
          yAxis: {
            ...series[label].yAxis,
            index: yAxis,
          },
        }
      : {
          yAxis: {
            index: yAxis,
          },
        };
    this.onSeriesOptionsUpdate(label, seriesOptionsUpdate);
  }

  onSeriesColorChange(label: string, color: string) {
    const {
      options: { series },
    } = this.props;
    const seriesOptionsUpdate: SeriesOptions = series[label]
      ? {
          ...series[label],
          color,
        }
      : {
          color,
        };

    this.onSeriesOptionsUpdate(label, seriesOptionsUpdate);
  }

  onToggleSort(sortBy: string) {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      legend: {
        ...options.legend,
        sortBy,
        sortDesc: sortBy === options.legend.sortBy ? !options.legend.sortDesc : false,
      },
    });
  }

  onHorizontalRegionSelected(from: number, to: number) {
    const { onChangeTimeRange } = this.props;
    onChangeTimeRange({ from, to });
  }

  render() {
    const { children } = this.props;
    const { graphSeriesModel } = this.state;

    return (
      <GraphSeriesToggler series={graphSeriesModel}>
        {({ onSeriesToggle, toggledSeries }) => {
          return children({
            series: toggledSeries,
            onSeriesColorChange: this.onSeriesColorChange,
            onSeriesAxisToggle: this.onSeriesAxisToggle,
            onToggleSort: this.onToggleSort,
            onSeriesToggle: onSeriesToggle,
            onHorizontalRegionSelected: this.onHorizontalRegionSelected,
          });
        }}
      </GraphSeriesToggler>
    );
  }
}

export class LoudMLTooltip extends React.Component {
  constructor(props: any) {
    super(props);
    this.data = props.data;

    window.console.log('LoudMLTooltip init', props);
  }

  formatFeature(value) {
    // window.console.log('Feature Value', value);
    const selectField = value.filter(o => o.type==='field');
    return selectField.map(o => o.params.join(', ')).join('; ')
  }

  formatGroupBy(value: any) {
    // window.console.log('Group By Value', value);
    const groupBy = value.filter(o => o.type==='time');
    return groupBy.map(o => [o.type, o.params].join(': ')).join(', ')
  }

  formatFillValue(value: any) {
    // window.console.log('Fill Value', value);
    const fill = value.filter(o => o.type==='fill');
    return fill.map(o => [o.type, o.params].join(': ')).join(', ')
  }

  formatTags(value: any) {
    // window.console.log('Tags Value', value);
    return value.map(o => [o.key, o.operator, o.value].join(' ')).join(', ')
  }

  render () {
    // window.console.log('groupBy', this.data.request.targets[0].groupBy);

    const feature = (
      (
        this.data.request.targets
        // &&this.data.request.targets.length===1
        &&this.data.request.targets[0].select
        &&this.data.request.targets[0].select.length===1
        &&this.formatFeature(this.data.request.targets[0].select[0])
      )
    )|| 'Select one field'

    const interval = (
      (
        this.data.request.targets
        // &&this.data.request.targets.length===1
        &&this.data.request.targets[0].groupBy
        &&this.formatGroupBy(this.data.request.targets[0].groupBy)
      )
    )|| 'Select a \'Group by\' value'

    const fill_value = (
        this.data.request.targets
        // &&this.data.request.targets.length===1
        &&this.data.request.targets[0].groupBy
        &&this.formatFillValue(this.data.request.targets[0].groupBy)
    )|| 'Select a \'Fill\' value'

    const tags_value = (
        this.data.request.targets
        // &&this.data.request.targets.length===1
        &&this.data.request.targets[0].tags
        &&this.formatTags(this.data.request.targets[0].tags)
    )|| '(Optional) Select a \'Tag(s)\' in WHERE statement'

    return (
      <div className='small'>
        <p>Use your current data selection to baseline normal metric behavior using a machine learning task.
          <br />
          This will create a new model, and run training to fit the baseline to your data.
          <br />
          You can visualise the baseline, and forecast future data using the Loud ML tab on the left panel once training is completed.
        </p>
        <p>
          <b>Feature:</b>
          <br />
          <code>{feature}</code>
        </p>
        <p>
          <b>groupBy bucket interval:</b>
          <br />
          <code>{interval}</code>
        </p>
        <p>
          <b>Match all:</b>
          <br />
          <code>{tags_value}</code>
        </p>
        <p>
          <b>Fill value:</b>
          <br />
          <code>{fill_value}</code>
        </p>
      </div>
    )
  }
}

export class CreateBaselineButton extends React.Component {
  constructor(props: any) {
    super(props);
    this.data = props.data;
    window.console.log('CreateBaselineButton init', props);
  }

  componentDidUpdate(prevProps) {
    this.data = this.props.data;
    // window.console.log('BaselineButton update', this.data);
  }

  isValid() {
    return (
      this.data.request.targets
      // &&this.data.request.targets.length===1
      &&this.data.request.targets[0].select
      &&this.data.request.targets[0].select.length===1
    )
  }

  _formatSelect(value: any) {
    const selectFunc = value.filter(o => o.type!=='field');
    const selectField = value.filter(o => o.type==='field');

    return selectFunc.map(o => o.type).join('_') + '_' + selectField.map(o => o.params.join('_')).join('_')
  }

  _formatTags(value: any) {
    return value.map(o => [o.key, o.value].join('_')).join('_')
  }

  _formatTime(value: any) {
    const groupBy = value.filter(o => o.type==='time');
    return groupBy.map(o => [o.type, o.params].join('_')).join('_')
  }

  _get_time(value: any) {
    const time = value.filter(o => o.type==='time');
    if (time.length !== 1) {
      return DEFAULT_MODEL.interval;
    }
    return time[0].params[0];
  }

  _get_feature(value: any) {
    const field = value.filter(o => o.type==='field');
    if (field.length === 0) {
      // TODO: check how we ended up with empty field and allowed user to click ML Button
      return "";
    }
    return field[0].params[0];
  }

  _get_func(value: any) {
    const func = value.filter(o => o.type!=='field');
    if (func.length === 0) {
      return "";
    }
    return func[0].type;
  }

  _get_fill(value: any) {
    const fill = value.filter(o => o.type==='fill');
    if (fill.length === 0) {
      return "null";
    }
    return fill[0].params[0];
  }

  normalizeInterval(bucketInterval: any) {
    // interval = max(5, min(bucketIntervak, 60))
    const regex = /(\d+)(.*)/
    const interval = regex.exec(bucketInterval)
    if (!interval) {
        return MIN_INTERVAL_UNIT
    }

    const duration = moment.duration(parseInt(interval[1], 10), interval[2]).asSeconds()
    if (!duration) {
        return MIN_INTERVAL_UNIT
    }

    const normalized = Math.max(
        MIN_INTERVAL_SECOND,
        Math.min(
            duration,
            MAX_INTERVAL_SECOND
        )
    )
    return `${normalized}s`
  }

  normalizeSpan(bucketInterval: any) {
    // span = max(10, min(24h/bucketInterval, 100))
    const regex = /(\d+)(.*)/
    const interval = regex.exec(bucketInterval)
    if (!interval) {
        return MIN_SPAN
    }

    const duration = moment.duration(parseInt(interval[1], 10), interval[2]).asSeconds()
    if (!duration) {
        return MIN_SPAN
    }

    return Math.max(MIN_SPAN, Math.min(Math.ceil(86400/duration), MAX_SPAN))
  }

  _createAndTrainModel() {
    // Model Example:
    // {
    //     "bucket_interval": "5m",
    //     "default_bucket": "telegraf_autogen_cpu",
    //     "features": [
    //         {
    //             "name": "mean_usage_user",
    //             "measurement": "cpu",
    //             "field": "usage_user",
    //             "metric": "mean",
    //             "io": "io",
    //             "default": null,
    //             "match_all": [
    //                 {
    //                     "tag": "cpu",
    //                     "value": "cpu-total"
    //                 },
    //                 {
    //                     "tag": "host",
    //                     "value": "macbook4823"
    //                 }
    //             ]
    //         }
    //     ],
    //     "interval": "60s",
    //     "max_evals": 10,
    //     "name": "telegraf_cpu_mean_usage_user_cpu_cpu_total_host_macbook4823_5m",
    //     "offset": "10s",
    //     "span": 100,
    //     "type": "donut"
    // }

    const source = this.data.request.targets[0];
    const fields = [source];
    const loudml = this.ds.loudml;

    this.getDatasource(source.datasource).then(result => {
      this.datasource = result;
      window.console.log("getDatasource", this.datasource);

      // TODO: find a way to pass all this.datasource connection params to Loud ML server
      // This will allow to auto create bucket to store ML Model training results

      // this.ds.loudml.createAndGetBucket(
      //   this.datasource.database,
      //   source.policy,
      //   source.measurement,
      //   this.datasource
      // ).then(result => {
      //     const bucket = result;
          const bucket = this.props.panelOptions.datasourceOptions.input_bucket;
          window.console.log("Input Bucket", bucket);

          const name = [
              this.datasource.database,
              source.measurement,
              this._formatSelect(source.select[0]),
              this._formatTags(source.tags),
              this._formatTime(source.groupBy),
          ].join('_')

          window.console.log("New ML Model name", name)

          // Group By Value – [{params: ["5m"], type: "time"}, {params: ["linear"], type: "fill"}]
          // Let parse a "5m" time from it
          const time = this._get_time(source.groupBy);
          const model = {
              ...DEFAULT_MODEL,
              max_evals: 10,
              name: name,
              interval: this.normalizeInterval(time),
              span: this.normalizeSpan(time),
              default_bucket: bucket, //bucket.name - if we will use createAndGetBucket()
              bucket_interval: time,
              features: fields.map(
                  (field) => ({
                          name: this._formatSelect(field.select[0]),
                          measurement: field.measurement,
                          field: this._get_feature(field.select[0]),
                          metric: this._get_func(field.select[0]),
                          io: 'io',
                          default: this._get_fill(source.groupBy),
                          match_all: field.tags.map(
                              (tag) => ({
                                      tag: tag.key,
                                      value: tag.value,
                                  })
                              ),
                      })
                  ),
          }

          window.console.log("ML Model", model)
          this.props.panelOptions.modelName = name;
          this.props.onOptionsChange(this.props.panelOptions);

          try {
            loudml.createModel(model).then(result => {
              window.console.log("createModel", result)
              loudml.createModelHook(model.name, loudml.createHook(ANOMALY_HOOK, model.default_bucket)).then(result => {
                window.console.log("createModelHook", result)
                // loudml.modelCreated(model)
                appEvents.emit(AppEvents.alertSuccess, ['Model has been created on Loud ML server']);

                this.props.panelOptions.modelName = name;
                this.props.onOptionsChange(this.props.panelOptions);

                try {
                  loudml.trainModel(model.name, this.data).then(result => {
                    window.console.log("trainModel", result)
                    appEvents.emit(AppEvents.alertSuccess, ['Model train job started on Loud ML server']);
                  }).catch(err => {
                    window.console.log("trainModel error", err)
                    appEvents.emit(AppEvents.alertError, ['Model train job error', err.data.message]);
                    return
                  });
                } catch (error) {
                  console.error(error)
                  appEvents.emit(AppEvents.alertError, ['Model train job error', err.message]);
                }

              }).catch(err => {
                window.console.log("createModelHook error", err)
                appEvents.emit(AppEvents.alertError, [err.message]);
                return
              });
            }).catch(err => {
              window.console.log("createModel error", err)
              appEvents.emit(AppEvents.alertError, ["Model create error", err.data]);
              return
            });
          } catch (err) {
            console.error(err)
            appEvents.emit(AppEvents.alertError, ['Model create error', err.message]);
            return
          }
        // })

    }).catch(err => {
      console.error(err);
      appEvents.emit(AppEvents.alertError, [err.message]);
      return
    });
  }

  async getDatasource(value: any) {
    // TODO: Consider to use this to get proper URL, username
    // getBackendSrv().get('api/datasources/' + 6)
    // .then(ds => {
    //   window.console.log(ds)
    // })

    return (await getDataSourceSrv().loadDatasource(value));
  }

  async getLoudMLDatasource() {
    return (await getDataSourceSrv().loadDatasource(this.dsName)) as LoudMLDatasource;
  }

  onCreateBaselineClick() {
    window.console.log(this);

    this.dsName = this.props.panelOptions.datasourceOptions.datasource;

    if (!this.dsName) {
      appEvents.emit(AppEvents.alertError, ['Please choose Loud ML Server in panel settings']);
      return
    }

    this.getLoudMLDatasource().then(result => {
        this.ds = result;
        window.console.log("getLoudMLDatasource", this.ds);

        // if (!this.ds.bucket) {
        //     appEvents.emit(AppEvents.alertError, ['Please choose Output bucket in Loud ML datasource settings']);
        //     return
        // }

        if (this.isValid()) {
          this._createAndTrainModel();
        } else {
          appEvents.emit(AppEvents.alertError, ['In Query settings please choose One metric; Group by != auto; Fill != linear']);
        }

    }).catch(err => {
      window.console.log("Error getting Loud ML datasource", err);
      appEvents.emit(AppEvents.alertError, [err.message]);
      return
    });
  }

  render () {
    const data = this.data;
    // window.console.log(this.isValid());
    return(
      <>
      <Button size="sm" className="btn btn-inverse" disabled={!this.isValid()}
        onClick={this.onCreateBaselineClick.bind(this)}>
        <i className="fa fa-graduation-cap fa-fw"></i>
        Create Baseline
      </Button>
      <Tooltip placement="top" content={<LoudMLTooltip data={data} />}>
        <span className="gf-form-help-icon">
          <i className="fa fa-info-circle" />
        </span>
      </Tooltip>
      </>
    )
  }
}
