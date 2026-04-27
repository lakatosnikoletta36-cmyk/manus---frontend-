// Wraps the 3D Avatar with an error boundary that falls back to the 2D SVG
// silhouette if WebGL/R3F crashes.
import React from 'react';
import Avatar from '@/components/Avatar';
import Avatar2D from '@/components/Avatar2D';

class AvatarBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { failed: true, err };
  }
  componentDidCatch(err, info) {
    // Log so devs can see; UI keeps running in 2D
    // eslint-disable-next-line no-console
    console.warn('[Avatar 3D failed → 2D fallback]', err?.message || err);
  }
  render() {
    if (this.state.failed) return <Avatar2D {...this.props} />;
    try {
      return <Avatar {...this.props} />;
    } catch (e) {
      return <Avatar2D {...this.props} />;
    }
  }
}

export default AvatarBoundary;
