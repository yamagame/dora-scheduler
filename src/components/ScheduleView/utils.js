import uuidv4 from 'uuid/v4';

const timeZoneOffset = (new Date()).getTimezoneOffset()*60*1000;

export default function({ unit, unitScale, }) {
  return {
    //hour
    timeZoneOffset: parseInt(timeZoneOffset/unitScale),
    //millisecond -> hour
    timePosition: function(millisecond) {
      return millisecond/unitScale;
    },
    //millisecond -> day
    dayPosition: function(millisecond) {
      return parseInt((millisecond/unitScale+unit/2)/unit)*unit;
    },
    dateStr: function(date) {
      const d = ("00"+date.getDate()).slice(-2);
      const y = ("00"+date.getFullYear()).slice(-4);
      const m = ("00"+(date.getMonth()+1)).slice(-2);
      return `${y}/${m}/${d}`
    },
    createBar: function(day, y, options={}) {
      let title = '';
      let text = '';
      let rgba = [ 0, 255, 0, 1 ];
      let width = 1;
      let height = 1;
      let grid = true;
      if ('title' in options) title = options.title;
      if ('text' in options) text = options.text;
      if ('rgba' in options) rgba = options.rgba;
      if ('width' in options) width = options.width;
      if ('height' in options) height = options.height;
      if ('grid' in options) grid = options.grid;
      const now = (new Date(day)).getTime();
      return {
        uuid: uuidv4(),
        x: this.timePosition(now),
        y: this.unit(y),
        width: this.unit(width),
        height: this.unit(height),
        type: 'roundrect',
        grid,
        rgba,
        title,
        text,
      }
    },
    toColor: function(rgba) {
      try {
        const toHex = (v) => {
          return ('00'+parseInt(v).toString(16)).substr(-2);
        }
        return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3]*255)}`.toUpperCase();
      } catch( err) {
        return '#00FF00FF';
      }
    },
    toRGBA: function(text) {
      try {
        if (text.trim().indexOf('#') === 0) {
          const m1 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
          const m2 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
          const m3 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
          const m4 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
          const color = text.trim().toUpperCase();
          const t = color.match(m1) || color.match(m2) || color.match(m3) || color.match(m4);
          if (t) {
            const r = parseInt(t[1],16);
            const g = parseInt(t[2],16);
            const b = parseInt(t[3],16);
            const a = (t.length >= 5) ? parseInt(t[4],16)/255 : 1;
            return [ r, g, b, a ];
          }
          return [ 0, 255, 0, 1 ];
        }
      } catch(err) {
      }
      return [ 0, 255, 0, 1 ];
    },
    barToCSV: function(bars) {
      const today = new Date();
      const csvMark = (x1, x2) => {
        const d1 = new Date(this.unitMillisecond(x1));
        const d2 = new Date(this.unitMillisecond(x2))
        const n1 = d1.getTime();
        const n2 = d2.getTime();
        if (n1 <= today && today < n2) return '▽';
        if (today < n1) return '□';
        return '■';
      }
      const csvStr = (s) => {
        if (s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
          return `"${s}"`
        }
        return s;
      }
      const csvDate = (x, w=0) => {
        const n = new Date(this.unitMillisecond(x+w));
        return `${n.getFullYear()}/${n.getMonth()+1}/${n.getDate()}`;
      }
      const nullCheck = (v) => {
        if (typeof v === 'undefined' || v === null) {
          return '';
        }
        return v;
      }
      let csv = '';
      bars.forEach( bar => {
        csv += `${csvMark(bar.x, bar.x+bar.width)}\t`
        csv += `${csvDate(bar.x)}\t`
        csv += `${csvDate(bar.x, bar.width-unit)}\t`
        csv += `${csvStr(nullCheck(bar.title))}\t${csvStr(nullCheck(bar.text))}\t${this.toColor(bar.rgba)}\t${bar.y}\t${nullCheck(bar.uuid)}\n`;
      })
      return csv;
    },
    CSVtoBar: function(csv) {
      try {
        const ret = [];
        let r = [''];
        let i = 0;
        let p = '';
        let s = true;
        for (let l in csv) {
          l = csv[l];
          if ('"' === l) {
            s = !s;
            if ('"' === p) {
              s = !s;
              r[i] += '"';
              l = '-';
            } else
            if ('' === p) {
              l = '-';
            }
          } else
          if (s && (',' === l || '\t' === l)) {
            r[++i] = '';
            l = '';
          } else
          if (s && '\n' === l) {
            i = 0;
            ret.push(r);
            r = [''];
            l = '';
          } else {
            r[i] += l;
          }
          p = l;
        }
        if (r) {
          ret.push(r);
        }
        const arrayToBar = (a) => {
          const bar = {
            height: unit,
          };
          const reg_date = '^([0-9]+)/([0-9]+)/([0-9]+)$';
          const reg_col1 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
          const reg_col2 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
          let count = 0;
          a.forEach( (v, i) => {
            if (v.trim().match(reg_date)) {
              const t = v.trim().match(reg_date);
              if (typeof bar.x == 'undefined') {
                count ++;
                bar.x = this.timePosition((new Date(t[0])).getTime()-timeZoneOffset);
              } else
              if (typeof bar.width == 'undefined') {
                count ++;
                bar.width = this.timePosition((new Date(t[0])).getTime()-timeZoneOffset)-bar.x+unit;
              }
            } else
            if (typeof bar.rgba === 'undefined' && (v.trim().match(reg_col1) || v.trim().match(reg_col2))) {
              count ++;
              bar.rgba = this.toRGBA(v);
            } else
            if (typeof bar.title === 'undefined' && i > 0) {
              count ++;
              bar.title = v;
            } else
            if (typeof bar.text === 'undefined' && i > 0) {
              count ++;
              bar.text = v;
            } else
            if (typeof bar.y === 'undefined' && i > 0) {
              count ++;
              bar.y = parseInt(v);
            } else
            if (typeof bar.uuid === 'undefined' && i > 0) {
              count ++;
              bar.uuid = v;
            }
          })
          if (count > 0) {
            if (!('x' in bar)) bar.x = this.dayPosition((new Date()).getTime());
            if (!('y' in bar)) bar.y = 0;
            if (!('title' in bar)) bar.title = '';
            if (!('text' in bar)) bar.text = '';
            if (!('width' in bar)) bar.width = unit;
            if (!('height' in bar)) bar.height = unit;
            if (!('uuid' in bar)) bar.uuid = uuidv4();
            if (!('rgba' in bar)) bar.rgba = [ 0, 255, 0, 1 ];
          }
          return bar;
        }
        return ret.map( v => arrayToBar(v) ).filter( bar => {
          if (!('x' in bar)) return false;
          if (!('y' in bar)) return false;
          if (!('title' in bar)) return false;
          if (!('text' in bar)) return false;
          if (!('width' in bar)) return false;
          if (!('height' in bar)) return false;
          if (!('uuid' in bar)) return false;
          if (!('rgba' in bar)) return false;
          return true;
        });
      } catch(err) {
        console.log(err);
      }
      return null;
    },
  }
}