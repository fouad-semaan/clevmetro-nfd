/**
* Copyright 2017, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/
const Rx = require('rxjs');
const Api = require('../api/naturalfeaturesdata');
const Utils = require('../utils/nfdUtils');
const FilterUtils = require('../utils/FilterUtils');

const {
    NFD_LOGIN_SUCCESS,
    NFD_LOGGED,
    UPDATE_NATURAL_FEATURE,
    DELETE_NATURAL_FEATURE,
    NATURAL_FEATURE_CREATED,
    endEditing
    } = require('../actions/naturalfeatures');
const {
    LOAD_LIST,
    listLoaded,
    loadList,
    onLoadListError,
    onListLoading,
    SELECT_FEATURE,
    ZOOM_TO_NFD_FEATURE,
    SEARCH_SPECIES,
    onSearchSepciesResult,
    onSearchSepciesError,
    RESET_FEATURETYPE_FILTERS,
    TOGGLE_FEATURETYPE,
    UPDATE_FILTERS_OPTIONS
} = require('../actions/featuresearch');

const {zoomToPoint} = require('../../MapStore2/web/client/actions/map');
const {error} = require('../../MapStore2/web/client/actions/notifications');
const {toggleControl} = require('../../MapStore2/web/client/actions/controls');

const load = (ftType, store, page = 1) => {
    const {featuresearch} = (store.getState());
    const filters = featuresearch[`${ftType}_filters`] || {};
    let filter = '';
    if (filters) {
        filter = FilterUtils.getFilter(filters);
    }
    return Rx.Observable.fromPromise(Api.getData(`/nfdapi/list/${ftType}/?page=${page}${filter}`))
            .map(val => listLoaded(ftType, val, page, filters))
            .catch((e) => Rx.Observable.from([error({title: Utils.getPrettyFeatureType(ftType), message: `Loading error ${e.statusText}`}), onLoadListError(ftType, e)]));
};
const getFilterOptions = (ftType) => {
    return Rx.Observable.fromPromise(
        Api.getFeatureSubtype(ftType))
        .map(resp => {
            if (resp.forms && resp.forms[0]) {
                const filters = ["reservation", "watershed", "cm_status"];
                const items = resp.forms.reduce((fields, f) => fields.concat(f.formitems.filter(({label}) => filters.indexOf(label) !== -1)), [])
                              .map((i) => ({name: i.label, options: i.values.items}));
                return {type: UPDATE_FILTERS_OPTIONS, items};
            }
        });
};

module.exports = {
    fetchFiltersOptions: (action$) =>
    action$.ofType(TOGGLE_FEATURETYPE)
    .switchMap(({activekey}) => getFilterOptions(Utils.getSubCatByCat(activekey))
                                .startWith(onListLoading(true))
                                .concat([onListLoading(false)])
                                ),
    fetchLists: (action$, store) =>
        action$.ofType(NFD_LOGIN_SUCCESS, NFD_LOGGED)
            .switchMap(() => {
                const {featureTypes = [], activeFt} = (store.getState()).featuresearch;
                const ftType = activeFt || featureTypes.length > 0 && featureTypes[0];
                return Rx.Observable.from(featureTypes.map((ft) => load(ft, store)).concat(getFilterOptions(Utils.getSubCatByCat(ftType))))
                        .mergeAll()
                        .startWith(onListLoading(true))
                        .concat([onListLoading(false)]);
            }),
    fetchList: (action$, store) =>
        action$.ofType(LOAD_LIST)
            .switchMap((a) => {
                return load(a.fttype, store, a.page).startWith(onListLoading(true, a.fttype)).concat([onListLoading(false, a.fttype)]);
            }),
    closePanel: (action$) =>
        action$.ofType(SELECT_FEATURE)
            .switchMap(() => Rx.Observable.of(toggleControl('features'))),
    zoomFeature: (action$, store) =>
        action$.ofType(ZOOM_TO_NFD_FEATURE)
            .switchMap( a => {
                const {mobile} = (store.getState()).browser;
                return Rx.Observable.from([zoomToPoint(a.feature.geometry.coordinates.slice(), a.zoom, "EPSG:4326")].concat(mobile ? [toggleControl('features')] : []));
            }),
    searchSpecies: (action$) =>
        action$.ofType(SEARCH_SPECIES)
            .switchMap(a =>
                Rx.Observable.fromPromise(Api.searchSpecies(a.query))
                    .map(options => onSearchSepciesResult(a.featureType, options))
                    .catch(e => Rx.Observable.of(onSearchSepciesError(a.featureType, e)))
            ),
    onClearFilter: (action$, store) =>
        action$.ofType(RESET_FEATURETYPE_FILTERS)
            .filter((a) => {
                const {featuresearch: fs} = store.getState();
                const filters = fs[`${a.fttype}_filters`];
                const fetureInfo = fs[a.fttype];
                return FilterUtils.getFilter({operator: fs.defaultOperator, ...filters}) !== FilterUtils.getFilter({operator: fs.defaultOperator, ...fetureInfo.filter});
            })
            .switchMap(a => Rx.Observable.of(loadList(a.fttype))),
            // Reloads appropriate list and stops editing
    onUpdateFeatureSuccess: (action$, store) =>
        action$.ofType(UPDATE_NATURAL_FEATURE, DELETE_NATURAL_FEATURE, NATURAL_FEATURE_CREATED)
            .filter(a => a.status === 'success')
            .switchMap(() => {
                const {naturalfeatures} = store.getState();
                const {featuretype: ft} = naturalfeatures;
                return Rx.Observable.from([loadList(ft), endEditing()]);
            })
};
