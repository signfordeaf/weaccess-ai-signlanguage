/**
 * The player.
 *
 * Two **independent blocks**, not one card: the stage and the control block,
 * with `spaceSm` between them. The window pill hangs above the stage's
 * top-right corner, outside its clip.
 *
 * ```
 *         ┌──────────────┐ ← window pill, 80% above the stage
 *  ┌──────┴──────────────┴──┐
 *  │ ▣ 👍👎                 │ ← mark badge, top-left
 *  │        signer          │   stage
 *  └────────────────────────┘
 *             ↕ 8 pt
 *  ┌────────────────────────┐
 *  │   ⏸     1.2x     ⟳     │ ← control bar
 *  │  Hesap gerçek kişi     │ ← caption, same surface, no divider
 *  └────────────────────────┘
 * ```
 *
 * There is deliberately **no on-screen sentence navigation**. The page itself
 * is the navigation: smart passthrough makes tapping the next sentence a single
 * gesture, so a `‹ n/m ›` strip would duplicate that at the cost of covering
 * the signer.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Animated,
  PanResponder,
  PixelRatio,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SignController } from '../controller/controller';
import { useControllerState } from '../controller/useSignController';
import { useSafeAreaInsets } from '../core/insets';
import { computePlayerLayout } from '../core/layout';
import { stringsFor } from '../core/strings';
import {
  COLLAPSED_BAR_WIDTH,
  MOTION,
  SHADOW,
  SIZE,
  SPACE,
} from '../core/tokens';
import { CollapsedBar } from './CollapsedBar';
import { SignCaption } from './SignCaption';
import { controlCountFor, SignControlBar } from './SignControlBar';
import { SignStage } from './SignStage';
import { WindowPill } from './WindowPill';

/** Past this much travel a touch is a drag, not a tap on a control. */
const DRAG_SLOP = 6;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface SignPlayerProps {
  controller: SignController;
}

export const SignPlayer: React.FC<SignPlayerProps> = ({ controller }) => {
  const state = useControllerState(controller);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets(screenWidth, screenHeight);
  const config = controller.config;
  const strings = stringsFor(config.language);

  // The video's own ratio, once it reports one. Until then the stage is sized
  // to the bundled clips' ratio, so it does not resize under the user.
  const [aspect, setAspect] = useState<number | undefined>(undefined);

  const fontScale = PixelRatio.getFontScale();

  const layout = useMemo(
    () =>
      computePlayerLayout({
        screenHeight,
        aspect,
        fontScale,
        avatarHeight: config.card.avatarHeight,
        avatarMaxWidth: config.card.avatarMaxWidth,
        controlCount: controlCountFor({
          showSpeed: config.card.showSpeed,
          showLoop: config.card.showLoop,
          showContact: config.card.showContact,
        }),
      }),
    [screenHeight, aspect, fontScale, config.card]
  );

  const collapsed = state.collapsed;

  // The caption block is drawn only once there is a sentence to put in it, so
  // an open player with nothing translated is just the control bar. The stage
  // is sized as though the caption were always there, so it does not resize
  // under the user when text arrives — only the block below it opens.
  const hasCaption = !!state.currentText;

  // The size the layout math *predicts*. Good enough to open at the right
  // corner on the first frame, but it is a prediction: it assumes every block
  // renders exactly as wide and as tall as computed here.
  const predicted = collapsed
    ? { width: COLLAPSED_BAR_WIDTH, height: SIZE.control }
    : {
        width: layout.totalWidth,
        height: hasCaption ? layout.totalHeight : layout.compactHeight,
      };

  /**
   * The size the player *actually* occupies, as reported by the platform.
   *
   * Clamping against the prediction is what let the player hang off the screen:
   * whenever the real card came out wider or taller than computed — a font the
   * caption wrapped differently, a control bar that grew, or simply a first
   * frame laid out before the window reported its final size — the position was
   * bounded against a footprint that did not exist, and nothing ever corrected
   * it, because the bounds only recompute when the *predicted* size changes.
   *
   * Measuring closes that loop: the frame feeds the bounds, the bounds feed the
   * clamp, and the clamp runs whenever either moves.
   */
  const [measured, setMeasured] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // A remount-free size change (collapse, caption arriving) invalidates the old
  // measurement; until the new one lands, the prediction stands in for it.
  useEffect(() => {
    setMeasured(null);
  }, [collapsed, hasCaption]);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    setMeasured((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height }
    );
  }, []);

  const footprint = measured ?? predicted;

  const bounds = useMemo(() => {
    const minX = insets.left + SPACE.md;
    const minY = insets.top + SPACE.md;
    return {
      minX,
      maxX: Math.max(
        minX,
        screenWidth - footprint.width - insets.right - SPACE.md
      ),
      minY,
      maxY: Math.max(
        minY,
        screenHeight - footprint.height - insets.bottom - SPACE.md
      ),
    };
  }, [screenWidth, screenHeight, footprint.width, footprint.height, insets]);

  // The player opens from a corner: `initialCorner` decides top vs bottom, and
  // the floating button's docked side decides left vs right, so it appears
  // where the user's finger already is.
  const initial = useMemo(() => {
    const corner = config.card.initialCorner;
    const top = corner === 'topLeft' || corner === 'topRight';
    return {
      x: state.dockSide === 'left' ? bounds.minX : bounds.maxX,
      y: top ? bounds.minY : bounds.maxY,
    };
    // Only the first mount's values matter; later changes are handled by the
    // clamping effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(new Animated.ValueXY(initial)).current;
  const position = useRef(initial);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = pan.addListener((value) => {
      position.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  // Entrance: fade plus a small upward slide, on the emphasized curve.
  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: MOTION.cardTransitionMs,
      useNativeDriver: true,
    });
    animation.start();
    // A frame callback outliving the component would touch a torn-down tree.
    return () => animation.stop();
  }, [entrance]);

  /**
   * Clamp to the safe area.
   *
   * Runs on every drag update, on release, **and after every frame**: the
   * player's size changes with the video's aspect ratio and the collapse state,
   * and without the post-layout correction the bottom of the control bar can
   * end up off screen.
   */
  const clampIntoBounds = useCallback(() => {
    const b = boundsRef.current;
    const next = {
      x: clamp(position.current.x, b.minX, b.maxX),
      y: clamp(position.current.y, b.minY, b.maxY),
    };
    if (next.x !== position.current.x || next.y !== position.current.y) {
      position.current = next;
      pan.setValue(next);
    }
  }, [pan]);

  useEffect(clampIntoBounds, [clampIntoBounds, bounds]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // A stationary tap must still reach the controls underneath, so the
        // drag only takes over past the platform's slop.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          config.card.draggable &&
          (Math.abs(gesture.dx) > DRAG_SLOP ||
            Math.abs(gesture.dy) > DRAG_SLOP),
        onPanResponderGrant: () => {
          pan.extractOffset();
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          pan.flattenOffset();
          clampIntoBounds();
        },
        onPanResponderTerminate: () => {
          pan.flattenOffset();
          clampIntoBounds();
        },
      }),
    [pan, clampIntoBounds, config.card.draggable]
  );

  if (!controller.playerVisible) return null;

  const { theme } = config;
  const radius = theme.cornerRadius;

  const surface = (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: entrance,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [footprint.height * 0.15, 0],
              }),
            },
          ],
        },
      ]}
      {...panResponder.panHandlers}
      accessibilityHint={config.accessibility.bottomSheetHint}
      onLayout={onMeasure}
    >
      {collapsed ? (
        <CollapsedBar
          primaryColor={theme.primaryColor}
          onPrimaryColor={theme.onPrimaryColor}
          radius={radius}
          strings={strings}
          closeLabel={config.accessibility.closeButtonLabel}
          onExpand={() => controller.expand()}
          onClose={() => controller.close()}
        />
      ) : (
        <View style={{ width: layout.totalWidth }}>
          {/* The pill hangs mostly outside the stage: `pillOverflow` of its
              height sits above the stage's top edge, so only the remainder
              costs the video any room. The negative margin pulls the stage up
              by exactly that remainder. */}
          <View
            style={[
              styles.pillRow,
              { marginBottom: -(SIZE.control - layout.pillOverflow) },
            ]}
          >
            <WindowPill
              collapsed={false}
              primaryColor={theme.primaryColor}
              onPrimaryColor={theme.onPrimaryColor}
              strings={strings}
              closeLabel={config.accessibility.closeButtonLabel}
              onToggleCollapsed={() => controller.collapse()}
              onClose={() => controller.close()}
            />
          </View>

          <View
            style={[
              styles.block,
              {
                alignSelf: 'center',
                backgroundColor: theme.surfaceColor,
                borderRadius: radius,
              },
            ]}
          >
            <SignStage
              state={state.translationState}
              width={layout.stageWidth}
              height={layout.stageHeight}
              radius={radius}
              videoUrl={state.videoUrl}
              isPlaying={state.isPlaying}
              speed={state.speed}
              looping={state.looping}
              signer={controller.signer}
              placeholderAsset={config.card.placeholderAsset}
              primaryColor={theme.primaryColor}
              surfaceColor={theme.surfaceColor}
              textColor={theme.textColor}
              strings={strings}
              showFeedback={config.card.showFeedback}
              feedbackVote={state.feedbackVote}
              feedbackAcknowledged={state.feedbackAcknowledged}
              onVote={(positive) => {
                void controller.vote(positive);
              }}
              videoPlayerLabel={config.accessibility.videoPlayerLabel}
              onVideoEnd={() => controller.reportVideoEnd()}
              onVideoError={() => controller.reportVideoError()}
              onAspectRatio={setAspect}
            />
          </View>

          {/* Two independent blocks, spaceSm apart. */}
          <View style={{ height: SPACE.sm }} />

          <View
            style={[
              styles.block,
              {
                alignSelf: 'center',
                backgroundColor: theme.primaryColor,
                borderRadius: radius,
              },
            ]}
          >
            <SignControlBar
              width={layout.barWidth}
              radius={radius}
              primaryColor={theme.primaryColor}
              onPrimaryColor={theme.onPrimaryColor}
              strings={strings}
              isPlaying={state.isPlaying}
              playbackAvailable={controller.playbackAvailable}
              speed={state.speed}
              looping={state.looping}
              showSpeed={config.card.showSpeed}
              showLoop={config.card.showLoop}
              showContact={config.card.showContact}
              isLastBlock={!hasCaption}
              onTogglePlayback={() => controller.togglePlayback()}
              onCycleSpeed={() => controller.cycleSpeed()}
              onToggleLoop={() => controller.toggleLoop()}
              onContact={() => {
                void controller.requestContact();
              }}
            />
            {hasCaption ? (
              <SignCaption
                text={state.currentText}
                width={layout.barWidth}
                height={layout.captionBlockHeight}
                primaryColor={theme.primaryColor}
                onPrimaryColor={theme.onPrimaryColor}
                fontScale={fontScale}
                radius={radius}
              />
            ) : null}
          </View>
        </View>
      )}
    </Animated.View>
  );

  // Non-modal by construction: only the player itself takes touches, so the app
  // underneath stays readable, scrollable and operable throughout.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {surface}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  block: {
    // The shadow needs a background on the *same* view to be drawn from a
    // shape rather than sampled — otherwise React Native warns that it cannot
    // compute it efficiently, and the result is a rectangle behind a rounded
    // block. The colour matches whatever the block itself paints, so it is
    // invisible.
    ...SHADOW.floating,
  },
});
