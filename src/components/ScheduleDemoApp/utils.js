export const toColor = function(rgba) {
  try {
    const toHex = (v) => {
      return ('00'+parseInt(v).toString(16)).substr(-2);
    }
    return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3]*255)}`.toUpperCase();
  } catch( err) {
    return '#00FF00FF';
  }
}

export const toRGBA = function(text) {
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
      return null;
    }
  } catch(err) {
  }
  return null;
}
