/* @flow */

import * as React from 'react';
import { View, ScrollView, StyleSheet, Platform, Animated } from 'react-native';
import { PagerRendererPropType } from './TabViewPropTypes';
import type { PagerRendererProps, Route } from './TabViewTypeDefinitions';

type ScrollEvent = {
  nativeEvent: {
    contentOffset: {
      x: number,
      y: number,
    },
  },
};

type State = {|
  initialOffset: {| x: number, y: number |},
|};

type Props<T> = PagerRendererProps<T>;

export default class TabViewPagerScroll<T: Route<*>> extends React.Component<
  Props<T>,
  State
> {
  static propTypes = PagerRendererPropType;

  constructor(props: Props<T>) {
    super(props);

    const { navigationState, layout } = this.props;

    this.state = {
      initialOffset: {
        x: navigationState.index * layout.width,
        y: 0,
      },
    };
  }

  componentDidMount() {
    global.requestAnimationFrame(() =>
      this._scrollTo(
        this.props.navigationState.index * this.props.layout.width,
        false
      )
    );
    this._resetListener = this.props.subscribe('reset', this._scrollTo);
  }

  componentWillReceiveProps(nextProps: Props<T>) {
    if (!this.props.layout.measured && nextProps.layout.measured) {
      const { navigationState, layout } = nextProps;
      this.setState({
        initialOffset: {
          x: navigationState.index * layout.width,
          y: 0,
        },
      });
    }
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.useNativeDriver !== this.props.useNativeDriver) {
      this._attachNativeEvent();
    }

    if (
      prevProps.navigationState !== this.props.navigationState ||
      prevProps.layout !== this.props.layout
    ) {
      const { navigationState, layout } = this.props;
      const offset = navigationState.index * layout.width;
      this._scrollTo(offset);
    }
  }

  componentWillUnmount() {
    this._resetListener && this._resetListener.remove();
    this._detachNativeEvent && this._detachNativeEvent.detach();
  }

  _scrollView: ?ScrollView;
  _resetListener: Object;
  _detachNativeEvent: Object;
  _currentOffset: ?number;
  _targetOffset: ?number;
  _isIdle: boolean = true;
  _isFirst: boolean = Platform.OS === 'ios';

  _scrollTo = (x: number, animated = this.props.animationEnabled !== false) => {
    if (animated && !this._isIdle) {
      return;
    }

    if (!this.props.useNativeDriver) {
      this.props.offsetX.setValue(x);
    }

    if (x !== this._currentOffset && this._scrollView) {
      this._targetOffset = x;
      this._scrollView.scrollTo({
        x,
        animated,
      });
    }
  };

  _handleMomentumScrollEnd = (e: ScrollEvent) => {
    const nextIndex = Math.round(
      e.nativeEvent.contentOffset.x / this.props.layout.width
    );
    this._isIdle = true;
    this.props.jumpToIndex(nextIndex);
  };

  _handleScrollAnimationEnd = () => {
    this._isIdle = true;
  };

  _handleScroll = (e: ScrollEvent) => {
    if (this._isFirst) {
      this._isFirst = false;
      return;
    }

    const { x } = e.nativeEvent.contentOffset;

    if (!this.props.useNativeDriver) {
      this.props.offsetX.setValue(x);
    }

    this._isIdle = (x === this._targetOffset);
    this._currentOffset = x;
  };

  _attachNativeEvent = () => {
    this._detachNativeEvent && this._detachNativeEvent.detach();

    if (this._scrollView && this.props.useNativeDriver) {
      this._detachNativeEvent = Animated.attachNativeEvent(
        this._scrollView.getScrollableNode(),
        'onScroll',
        [{nativeEvent: {contentOffset: {x: this.props.offsetX}}}],
      );
    }
  };

  _setRef = (el: Object) => {
    this._scrollView = el;
    this._attachNativeEvent();
  };

  render() {
    const { children, layout, navigationState } = this.props;
    return (
      <ScrollView
        horizontal
        pagingEnabled
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="always"
        overScrollMode="never"
        scrollEnabled={this.props.swipeEnabled}
        automaticallyAdjustContentInsets={false}
        bounces={false}
        alwaysBounceHorizontal={false}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={this._handleScroll}
        onScrollAnimationEnd={this._handleScrollAnimationEnd}
        onMomentumScrollEnd={this._handleMomentumScrollEnd}
        contentOffset={this.state.initialOffset}
        style={styles.container}
        contentContainerStyle={layout.width ? null : styles.container}
        ref={this._setRef}
      >
        {React.Children.map(children, (child, i) => (
          <View
            key={navigationState.routes[i].key}
            testID={navigationState.routes[i].testID}
            style={
              layout.width
                ? { width: layout.width, overflow: 'hidden' }
                : i === navigationState.index ? styles.page : null
            }
          >
            {i === navigationState.index || layout.width ? child : null}
          </View>
        ))}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  page: {
    flex: 1,
    overflow: 'hidden',
  },
});
