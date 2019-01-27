import { combineReducers } from 'redux'
import 'whatwg-fetch'

const SET_PARAMS = 'SET_PARAMS';

export const actionTypes = {
  SET_PARAMS,
}

export const initialState = {
  app: {
    barData: [],
  },
}

const app = (state = initialState.app, action) => {
  switch (action.type) {
    case SET_PARAMS:
      return {
        ...state,
        ...action.payload,
      }
    default:
      return state;
  }
}

export const rootReducers = combineReducers({
  app,
})

export const setParams = (payload) => async (dispatch, getState) => {
  dispatch({
    type: SET_PARAMS,
    payload,
  });
}

const toColor = function(rgba) {
  const toHex = (v) => {
    return ('00'+parseInt(v).toString(16)).substr(-2);
  }
  return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3]*0xFF)}`.toUpperCase();
}

const toRGBA = function(text) {
  try {
    if (text.trim().indexOf('#') === 0) {
      const m1 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
      const m2 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
      const color = text.trim().toUpperCase();
      const t = color.match(m1) || color.match(m2);
      if (t) {
        const r = parseInt(t[1],16);
        const g = parseInt(t[2],16);
        const b = parseInt(t[3],16);
        const a = parseInt(t[4],16);
        return [ r, g, b, a/0xFF ];
      }
      return [ 0x00, 0xFF, 0x00, 1];
    }
  } catch(err) {
  }
  return [ 0x00, 0xFF, 0x00, 1];
}

export const loadBarData = (params={}, callback) => async (dispatch, getState) => {
  const { app: { user_id, signature, barData, } } = getState();
  let response = await fetch('/bar/all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
  });
  if (response.ok) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      let data = await response.json();
      data = data.map( bar => {
        bar.rgba = toRGBA(bar.rgba);
        return bar;
      })
      if (typeof params.bars !== 'undefined') {
        const bars = [ ...barData ];
        data.forEach( d => {
          if (!bars.some( b => {
            if (b.uuid === d.uuid) {
              Object.keys(d).forEach( k => {
                b[k] = d[k];
              })
              return true;
            }
            return false;
          })) {
            bars.push(d);
          }
        })
        data = bars;
      }
      dispatch({
        type: SET_PARAMS,
        payload: {
          barData: data,
          user_id,
          signature,
        },
      });
      if (callback) callback(data);
    } else {
      let data = await response.text();
      console.log(data);
    }
  } else {
    console.log('ERROR');
  }
}

const saveBarCommon = async (bars, callback, dispatch, getState, create=false) => {
  const { app: { user_id, signature, } } = getState();
  let response = await fetch('/bar/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      barData: bars.map( bar => {
        return {
          ...bar,
          rgba: toColor(bar.rgba),
        }
      }),
      saveOnly: true,
      user_id,
      create,
      signature,
    }),
  });
  if (response.ok) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      let data = await response.json();
      if (callback) callback(null, data);
      return;
    }
  } else {
    console.log('ERROR');
  }
}

export const createBarData = (bars, callback) => async (dispatch, getState) => {
  await saveBarCommon(bars, callback, dispatch, getState, true);
  if (callback) callback();
}

export const saveBarData = (bars, callback) => async (dispatch, getState) => {
  await saveBarCommon(bars, callback, dispatch, getState);
  if (callback) callback();
}

export const delBarData = (bars, callback) => async (dispatch, getState) => {
  const { app: { user_id, signature, barData, } } = getState();
  let response = await fetch('/bar/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      barData: bars.map( bar => {
        return {
          ...bar,
          rgba: toColor(bar.rgba),
        }
      }),
      saveOnly: true,
      user_id,
      signature,
    }),
  });
  if (response.ok) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      let data = await response.json();
      if (callback) callback(null, data);
      return;
    }
  } else {
    console.log('ERROR');
  }
  if (callback) callback();
}

export const saveCalendarData = (calendarData, callback) => async (dispatch, getState) => {
  const { app: { user_id, signature, } } = getState();
  let response = await fetch('/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      calendarData,
      user_id,
      signature,
    }),
  });
  if (response.ok) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      let data = await response.json();
      if (callback) callback(null, data);
      return;
    }
  } else {
    console.log('ERROR');
  }
}

export const loadCalendarData = (callback) => async (dispatch, getState) => {
  let response = await fetch('/calendar', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
  });
  if (response.ok) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      let data = await response.json();
      if (callback) callback(null, data);
      return;
    }
  } else {
    console.log('ERROR');
  }
}

export const initialData = (params, callback) => async (dispatch, getState) => {
  let signature = null;
  let user_id = null;
  let response = await fetch('/access-token', {
    method: 'POST',
  });
  if (response.ok) {
    let data = await response.json();
    signature = data.signature;
    user_id = data.user_id;
    dispatch({
      type: SET_PARAMS,
      payload: {
        user_id,
        signature,
      },
    });
    if (callback) callback();
  } else {
    if (process.env.NODE_ENV === 'production') {
      window.location = '/admin-page';
    }
    console.log('ERROR');
  }
}
