import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// Single source of truth for Kodara's design tokens, translated 1:1 from
/// docs/DESIGN_SYSTEM.md. Every color/spacing/radius/shadow/motion value the
/// app uses must come from here — no hex literals, magic paddings, ad hoc
/// durations, or inline BoxShadows anywhere else in lib/. This keeps the
/// Flutter client visually identical to the Next.js web app, which consumes
/// the same spec.
///
/// Section numbers below mirror DESIGN_SYSTEM.md section numbers.
class KodaraColors {
  const KodaraColors._();

  // 1. Color — "The Accent" + "Symbolism"
  // The ONE accent: primary buttons, active nav/tab, links, live-payment
  // dot, focus rings, chart fill, the single hero number per screen.
  static const Color accent = Color(0xFF0B8D70);

  // Pressed/hover-equivalent of accent only. Never used standalone.
  static const Color accentDark = Color(0xFF087A63);

  // Subtle backgrounds: active nav row, selected badge, hover row.
  static const Color accentTint = Color(0x140B8D70); // accent @ 8% opacity

  // Focus ring glow, stronger badge fill.
  static const Color accentTintStrong = Color(0x240B8D70); // accent @ 14%

  // The one dark chrome surface: app bar/header backgrounds, tenant balance
  // card, bottom nav bar background if dark. Not used for body text.
  static const Color ink = Color(0xFF0B2922);

  // Warm paper foundation — matches the web DESIGN.md tokens (the page is
  // paper, not plastic).
  static const Color background = Color(0xFFFAF9F7);
  static const Color surface = Color(0xFFFFFFFF);

  static const Color textPrimary = Color(0xFF201D1A);
  static const Color textSecondary = Color(0xFF7C766D);

  static const Color border = Color(0xFFE8E5DF);

  // Semantic states — used ONLY for their real meaning, never decoratively.
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);

  // Tinted variants of the semantic colors for pill/badge backgrounds
  // (approx. 14% opacity over white, matching the accentTintStrong ratio).
  static const Color successTint = Color(0x2410B981);
  static const Color warningTint = Color(0x24F59E0B);
  static const Color errorTint = Color(0x24EF4444);

  /// Foreground-on-white text color to pair with [ink] surfaces at reduced
  /// opacity, for secondary copy on the tenant balance card etc.
  static const Color onInkSecondary = Color(0xB3FFFFFF); // white @ ~70%
  static const Color onInkMuted = Color(0x99FFFFFF); // white @ 60%
}

class KodaraSpacing {
  const KodaraSpacing._();

  // 3. Spacing — 8px base grid.
  static const double space1 = 4;
  static const double space2 = 8;
  static const double space3 = 12;
  static const double space4 = 16;
  static const double space5 = 24;
  static const double space6 = 32;
  static const double space8 = 48;
  static const double space10 = 64;

  /// Tenant portal frame width (tenant portal is intentionally narrow /
  /// mobile-first). Mirrors --frame-tenant on web.
  static const double frameTenant = 520;
}

class KodaraRadius {
  const KodaraRadius._();

  // 4. Radius — "Denoising"
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22; // bottom sheets / full-screen mobile modals
  static const double full = 999; // pills, avatars, dots
}

class KodaraShadows {
  const KodaraShadows._();

  // 5. Shadow — direct translation of the rgba box-shadow values.
  // Default card.
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x140F172A), offset: Offset(0, 1), blurRadius: 3),
  ];

  // Hover/dropdown/popover.
  static const List<BoxShadow> elevated = [
    BoxShadow(color: Color(0x1F0F172A), offset: Offset(0, 4), blurRadius: 12),
  ];

  // Modal/sheet.
  static const List<BoxShadow> modal = [
    BoxShadow(color: Color(0x330F172A), offset: Offset(0, 10), blurRadius: 30),
  ];

  // The ONE featured surface per screen (tenant balance card, primary CTA) —
  // a green-tinted shadow so the shadow itself signals "this is the
  // important one," not just generic elevation.
  static const List<BoxShadow> accent = [
    BoxShadow(color: Color(0x380B8D70), offset: Offset(0, 16), blurRadius: 32),
  ];
}

class KodaraMotion {
  const KodaraMotion._();

  // 6. Motion
  static const Duration fast =
      Duration(milliseconds: 120); // button press, toggle
  static const Duration base =
      Duration(milliseconds: 180); // hover, focus, tab switch
  static const Duration slow = Duration(milliseconds: 260); // modal/sheet enter

  /// cubic-bezier(.4,0,.2,1) — default for everything.
  static const Curve easeStandard = Cubic(0.4, 0, 0.2, 1);

  /// cubic-bezier(.32,.72,0,1) — modal/sheet entrance only.
  static const Curve easeSpring = Cubic(0.32, 0.72, 0, 1);
}

class KodaraTypography {
  const KodaraTypography._();

  // 2. Typography — tight modular scale; exactly one "hero" size per screen.
  static const double xs = 12; // meta, timestamps
  static const double sm = 13; // labels, captions
  static const double base = 14; // body
  static const double md = 16; // body-lg, h4
  static const double lg = 18; // h4 / emphasis
  static const double xl = 20; // h3
  static const double xxl = 25; // h2 (20 * 1.25)
  static const double display = 34; // h1 (~21 * 1.618)

  /// The ONE golden-ratio hero number per screen only (balance amount,
  /// headline chart stat). Never use this size more than once per screen.
  static const double hero = 40;

  static TextTheme textTheme(Color primary, Color secondary) {
    return TextTheme(
      // Hero is intentionally NOT part of the standard TextTheme slots so it
      // can't be reached for accidentally — use KodaraTypography.heroStyle
      // explicitly at the one call site per screen instead.
      displayLarge: TextStyle(
          fontSize: display,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.15),
      displayMedium: TextStyle(
          fontSize: xxl,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.2),
      displaySmall: TextStyle(
          fontSize: xl,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.25),
      headlineLarge: TextStyle(
          fontSize: xxl,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.2),
      headlineMedium: TextStyle(
          fontSize: xl,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.25),
      headlineSmall: TextStyle(
          fontSize: lg,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.3),
      titleLarge: TextStyle(
          fontSize: lg,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.3),
      titleMedium: TextStyle(
          fontSize: md,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.3),
      titleSmall: TextStyle(
          fontSize: base,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.35),
      bodyLarge: TextStyle(
          fontSize: md,
          fontWeight: FontWeight.w400,
          color: primary,
          height: 1.4),
      bodyMedium: TextStyle(
          fontSize: base,
          fontWeight: FontWeight.w400,
          color: primary,
          height: 1.4),
      bodySmall: TextStyle(
          fontSize: sm,
          fontWeight: FontWeight.w400,
          color: secondary,
          height: 1.4),
      labelLarge: TextStyle(
          fontSize: base,
          fontWeight: FontWeight.w600,
          color: primary,
          height: 1.3),
      labelMedium: TextStyle(
          fontSize: sm,
          fontWeight: FontWeight.w600,
          color: secondary,
          height: 1.3),
      labelSmall: TextStyle(
          fontSize: xs,
          fontWeight: FontWeight.w600,
          color: secondary,
          height: 1.3),
    );
  }

  /// The single hero number style (40px, weight 700 — hero + nav-active are
  /// the only places weight goes above 600). Apply this to at most one
  /// number per screen: the tenant balance amount on the home tab, and the
  /// top headline stat on the landlord portfolio tab.
  static const TextStyle heroStyle = TextStyle(
    fontSize: hero,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    height: 1.1,
    letterSpacing: -0.5,
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
  );

  /// Hero number variant for use on light surfaces (accent- or ink-free
  /// background) — same size/weight, dark text.
  static const TextStyle heroStyleOnLight = TextStyle(
    fontSize: hero,
    fontWeight: FontWeight.w700,
    color: KodaraColors.textPrimary,
    height: 1.1,
    letterSpacing: -0.5,
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
  );
}

/// App-wide [ThemeExtension] so widgets can reach tokens via
/// `Theme.of(context).extension<KodaraThemeExtension>()` when a raw
/// constant isn't convenient (e.g. inside const contexts prefer the
/// static classes above; this extension is for theme-driven lookups).
@immutable
class KodaraThemeExtension extends ThemeExtension<KodaraThemeExtension> {
  const KodaraThemeExtension({
    required this.accent,
    required this.accentDark,
    required this.accentTint,
    required this.accentTintStrong,
    required this.ink,
    required this.success,
    required this.warning,
    required this.error,
    required this.textSecondary,
    required this.border,
  });

  final Color accent;
  final Color accentDark;
  final Color accentTint;
  final Color accentTintStrong;
  final Color ink;
  final Color success;
  final Color warning;
  final Color error;
  final Color textSecondary;
  final Color border;

  static const KodaraThemeExtension standard = KodaraThemeExtension(
    accent: KodaraColors.accent,
    accentDark: KodaraColors.accentDark,
    accentTint: KodaraColors.accentTint,
    accentTintStrong: KodaraColors.accentTintStrong,
    ink: KodaraColors.ink,
    success: KodaraColors.success,
    warning: KodaraColors.warning,
    error: KodaraColors.error,
    textSecondary: KodaraColors.textSecondary,
    border: KodaraColors.border,
  );

  @override
  KodaraThemeExtension copyWith({
    Color? accent,
    Color? accentDark,
    Color? accentTint,
    Color? accentTintStrong,
    Color? ink,
    Color? success,
    Color? warning,
    Color? error,
    Color? textSecondary,
    Color? border,
  }) {
    return KodaraThemeExtension(
      accent: accent ?? this.accent,
      accentDark: accentDark ?? this.accentDark,
      accentTint: accentTint ?? this.accentTint,
      accentTintStrong: accentTintStrong ?? this.accentTintStrong,
      ink: ink ?? this.ink,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      textSecondary: textSecondary ?? this.textSecondary,
      border: border ?? this.border,
    );
  }

  @override
  KodaraThemeExtension lerp(
      ThemeExtension<KodaraThemeExtension>? other, double t) {
    if (other is! KodaraThemeExtension) return this;
    return KodaraThemeExtension(
      accent: Color.lerp(accent, other.accent, t)!,
      accentDark: Color.lerp(accentDark, other.accentDark, t)!,
      accentTint: Color.lerp(accentTint, other.accentTint, t)!,
      accentTintStrong:
          Color.lerp(accentTintStrong, other.accentTintStrong, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      border: Color.lerp(border, other.border, t)!,
    );
  }
}

/// Builds the app's [ThemeData] from the tokens above. This is the only
/// place a [ColorScheme] is constructed — main.dart just calls this.
ThemeData buildKodaraTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: KodaraColors.accent,
    onPrimary: Colors.white,
    primaryContainer: KodaraColors.accentTint,
    onPrimaryContainer: KodaraColors.accentDark,
    secondary: KodaraColors.ink,
    onSecondary: Colors.white,
    secondaryContainer: KodaraColors.accentTint,
    onSecondaryContainer: KodaraColors.ink,
    tertiary: KodaraColors.accentDark,
    onTertiary: Colors.white,
    error: KodaraColors.error,
    onError: Colors.white,
    errorContainer: KodaraColors.errorTint,
    onErrorContainer: KodaraColors.error,
    surface: KodaraColors.surface,
    onSurface: KodaraColors.textPrimary,
    surfaceContainerHighest: KodaraColors.background,
    onSurfaceVariant: KodaraColors.textSecondary,
    outline: KodaraColors.border,
    outlineVariant: KodaraColors.border,
    shadow: Color(0x140F172A),
    scrim: Color(0x800F172A),
    inverseSurface: KodaraColors.ink,
    onInverseSurface: Colors.white,
    inversePrimary: KodaraColors.accentTintStrong,
  );

  final textTheme = KodaraTypography.textTheme(
      KodaraColors.textPrimary, KodaraColors.textSecondary);

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: KodaraColors.background,
    textTheme: textTheme,
    splashColor: KodaraColors.accentDark.withValues(alpha: 0.12),
    highlightColor: KodaraColors.accentDark.withValues(alpha: 0.08),
    fontFamily: null,
    appBarTheme: const AppBarTheme(
      backgroundColor: KodaraColors.surface,
      foregroundColor: KodaraColors.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: KodaraColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.md),
        side: const BorderSide(color: KodaraColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: KodaraColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: const BorderSide(color: KodaraColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: const BorderSide(color: KodaraColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: const BorderSide(color: KodaraColors.accent, width: 1.5),
      ),
      labelStyle: const TextStyle(color: KodaraColors.textSecondary),
      hintStyle: const TextStyle(color: KodaraColors.textSecondary),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: KodaraColors.accent,
        foregroundColor: Colors.white,
        disabledBackgroundColor: KodaraColors.accent.withValues(alpha: 0.4),
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KodaraRadius.sm)),
        textStyle: const TextStyle(
            fontWeight: FontWeight.w600, fontSize: KodaraTypography.base),
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? KodaraColors.accentDark.withValues(alpha: 0.16)
              : null,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: KodaraColors.accent,
        side: const BorderSide(color: KodaraColors.border),
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KodaraRadius.sm)),
        textStyle: const TextStyle(
            fontWeight: FontWeight.w600, fontSize: KodaraTypography.base),
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? KodaraColors.accentTint
              : null,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: KodaraColors.accent,
        textStyle: const TextStyle(
            fontWeight: FontWeight.w600, fontSize: KodaraTypography.base),
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? KodaraColors.accentTint
              : null,
        ),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: KodaraColors.accent,
      foregroundColor: Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: KodaraColors.surface,
      indicatorColor: KodaraColors.accentTint,
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: KodaraTypography.xs,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
          color: selected ? KodaraColors.accent : KodaraColors.textSecondary,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? KodaraColors.accent : KodaraColors.textSecondary,
        );
      }),
    ),
    dividerTheme: const DividerThemeData(
        color: KodaraColors.border, thickness: 1, space: 1),
    iconTheme: const IconThemeData(color: KodaraColors.textSecondary),
    listTileTheme: const ListTileThemeData(
      iconColor: KodaraColors.textSecondary,
      textColor: KodaraColors.textPrimary,
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: KodaraColors.accent),
    dialogTheme: DialogThemeData(
      backgroundColor: KodaraColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KodaraRadius.lg)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: KodaraColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(KodaraRadius.xl)),
      ),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    extensions: const [KodaraThemeExtension.standard],
  );
}
