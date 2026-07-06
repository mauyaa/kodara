import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// Single source of truth for Kodara's design tokens, translated 1:1 from
/// DESIGN.md (warm paper + one emerald accent). Every color/spacing/radius/
/// shadow/motion value the app uses must come from here — no hex literals,
/// magic paddings, ad hoc durations, or inline BoxShadows anywhere else in
/// lib/. This keeps the Flutter client visually identical to the web app.
///
/// Widgets must not reference [KodaraColors] directly for anything that has
/// to invert in dark mode — use `context.kodara` (the theme extension) so
/// both themes render correctly.

const String kodaraFontFamily = 'Geist';
// Every money figure, receipt code, and phone number sets in this — same
// pairing as the web app (Geist Sans + Geist Mono), so tabular numerals
// look identical on both clients.
const String kodaraMonoFontFamily = 'GeistMono';

class KodaraColors {
  const KodaraColors._();

  // The ONE accent: primary buttons, active nav/tab, links, live-payment
  // dot, focus rings, the single hero number per screen.
  static const Color accent = Color(0xFF0B8D70);
  static const Color accentDark = Color(0xFF087A63);
  static const Color accentTint = Color(0x140B8D70);
  static const Color accentTintStrong = Color(0x240B8D70);

  // The one dark chrome surface: tenant balance card.
  static const Color ink = Color(0xFF0B2922);

  // Warm paper foundation — matches the web DESIGN.md tokens.
  static const Color background = Color(0xFFFAF9F7);
  static const Color surface = Color(0xFFFFFFFF);

  static const Color textPrimary = Color(0xFF201D1A);
  static const Color textSecondary = Color(0xFF7C766D);

  static const Color border = Color(0xFFE8E5DF);

  // Semantic states — used ONLY for their real meaning, never decoratively.
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);

  static const Color successTint = Color(0x2410B981);
  static const Color warningTint = Color(0x24F59E0B);
  static const Color errorTint = Color(0x24EF4444);

  static const Color onInkSecondary = Color(0xB3FFFFFF);
  static const Color onInkMuted = Color(0x99FFFFFF);
}

/// Dark counterparts. Warm near-black, not blue-black; the accent gains
/// luminance so it keeps AA contrast on dark surfaces.
class KodaraColorsDark {
  const KodaraColorsDark._();

  static const Color accent = Color(0xFF2FB68E);
  static const Color accentDark = Color(0xFF26A37E);
  static const Color accentTint = Color(0x1F2FB68E);
  static const Color accentTintStrong = Color(0x332FB68E);

  // Balance card ink lifts slightly above the background.
  static const Color ink = Color(0xFF11362C);

  static const Color background = Color(0xFF14120F);
  static const Color surface = Color(0xFF1D1A16);

  static const Color textPrimary = Color(0xFFF3F1ED);
  static const Color textSecondary = Color(0xFFA39C92);

  static const Color border = Color(0xFF322E28);

  static const Color success = Color(0xFF34D399);
  static const Color warning = Color(0xFFFBBF24);
  static const Color error = Color(0xFFF87171);

  static const Color successTint = Color(0x2934D399);
  static const Color warningTint = Color(0x29FBBF24);
  static const Color errorTint = Color(0x29F87171);

  static const Color onInkSecondary = Color(0xB3FFFFFF);
  static const Color onInkMuted = Color(0x99FFFFFF);
}

class KodaraSpacing {
  const KodaraSpacing._();

  static const double space1 = 4;
  static const double space2 = 8;
  static const double space3 = 12;
  static const double space4 = 16;
  static const double space5 = 24;
  static const double space6 = 32;
  static const double space8 = 48;
  static const double space10 = 64;

  static const double frameTenant = 520;
}

class KodaraRadius {
  const KodaraRadius._();

  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
  static const double full = 999;
}

class KodaraShadows {
  const KodaraShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x141C1917), offset: Offset(0, 1), blurRadius: 3),
  ];

  static const List<BoxShadow> elevated = [
    BoxShadow(color: Color(0x1F1C1917), offset: Offset(0, 4), blurRadius: 12),
  ];

  static const List<BoxShadow> modal = [
    BoxShadow(color: Color(0x331C1917), offset: Offset(0, 10), blurRadius: 30),
  ];

  /// The ONE featured surface per screen (tenant balance card) — a
  /// green-tinted shadow so the shadow itself signals importance.
  static const List<BoxShadow> accent = [
    BoxShadow(color: Color(0x380B8D70), offset: Offset(0, 16), blurRadius: 32),
  ];
}

class KodaraMotion {
  const KodaraMotion._();

  static const Duration fast = Duration(milliseconds: 120);
  static const Duration base = Duration(milliseconds: 180);
  static const Duration slow = Duration(milliseconds: 260);

  static const Curve easeStandard = Cubic(0.4, 0, 0.2, 1);
  static const Curve easeSpring = Cubic(0.32, 0.72, 0, 1);
}

class KodaraTypography {
  const KodaraTypography._();

  static const double xs = 12;
  static const double sm = 13;
  static const double base = 14;
  static const double md = 16;
  static const double lg = 18;
  static const double xl = 20;
  static const double xxl = 25;
  static const double display = 34;

  /// The ONE golden-ratio hero number per screen only.
  static const double hero = 40;

  static TextTheme textTheme(Color primary, Color secondary) {
    TextStyle style(
            double size, FontWeight weight, Color color, double height) =>
        TextStyle(
          fontFamily: kodaraFontFamily,
          fontSize: size,
          fontWeight: weight,
          color: color,
          height: height,
        );

    return TextTheme(
      displayLarge: style(display, FontWeight.w600, primary, 1.15),
      displayMedium: style(xxl, FontWeight.w600, primary, 1.2),
      displaySmall: style(xl, FontWeight.w600, primary, 1.25),
      headlineLarge: style(xxl, FontWeight.w600, primary, 1.2),
      headlineMedium: style(xl, FontWeight.w600, primary, 1.25),
      headlineSmall: style(lg, FontWeight.w600, primary, 1.3),
      titleLarge: style(lg, FontWeight.w600, primary, 1.3),
      titleMedium: style(md, FontWeight.w600, primary, 1.3),
      titleSmall: style(base, FontWeight.w600, primary, 1.35),
      bodyLarge: style(md, FontWeight.w400, primary, 1.4),
      bodyMedium: style(base, FontWeight.w400, primary, 1.4),
      bodySmall: style(sm, FontWeight.w400, secondary, 1.4),
      labelLarge: style(base, FontWeight.w600, primary, 1.3),
      labelMedium: style(sm, FontWeight.w600, secondary, 1.3),
      labelSmall: style(xs, FontWeight.w600, secondary, 1.3),
    );
  }

  /// The single hero number style. At most one per screen.
  static const TextStyle heroStyle = TextStyle(
    fontFamily: kodaraMonoFontFamily,
    fontSize: hero,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    height: 1.1,
    letterSpacing: -0.5,
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
  );

  /// Reusable style for any secondary money/receipt/reference figure —
  /// same mono treatment as the hero, at body size.
  static TextStyle moneyStyle(Color color, {double size = base}) => TextStyle(
        fontFamily: kodaraMonoFontFamily,
        fontSize: size,
        fontWeight: FontWeight.w600,
        color: color,
        fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
      );

  /// Eyebrow label — uppercase micro-heading above a section or hero.
  static const TextStyle eyebrow = TextStyle(
    fontFamily: kodaraFontFamily,
    fontSize: xs,
    fontWeight: FontWeight.w600,
    letterSpacing: 1.4,
    height: 1.3,
  );
}

/// App-wide [ThemeExtension]; widgets reach tokens via `context.kodara` so
/// light and dark both resolve correctly.
@immutable
class KodaraThemeExtension extends ThemeExtension<KodaraThemeExtension> {
  const KodaraThemeExtension({
    required this.accent,
    required this.accentDark,
    required this.accentTint,
    required this.accentTintStrong,
    required this.ink,
    required this.background,
    required this.surface,
    required this.textPrimary,
    required this.textSecondary,
    required this.border,
    required this.success,
    required this.warning,
    required this.error,
    required this.successTint,
    required this.warningTint,
    required this.errorTint,
    required this.onInkSecondary,
    required this.onInkMuted,
  });

  final Color accent;
  final Color accentDark;
  final Color accentTint;
  final Color accentTintStrong;
  final Color ink;
  final Color background;
  final Color surface;
  final Color textPrimary;
  final Color textSecondary;
  final Color border;
  final Color success;
  final Color warning;
  final Color error;
  final Color successTint;
  final Color warningTint;
  final Color errorTint;
  final Color onInkSecondary;
  final Color onInkMuted;

  static const KodaraThemeExtension light = KodaraThemeExtension(
    accent: KodaraColors.accent,
    accentDark: KodaraColors.accentDark,
    accentTint: KodaraColors.accentTint,
    accentTintStrong: KodaraColors.accentTintStrong,
    ink: KodaraColors.ink,
    background: KodaraColors.background,
    surface: KodaraColors.surface,
    textPrimary: KodaraColors.textPrimary,
    textSecondary: KodaraColors.textSecondary,
    border: KodaraColors.border,
    success: KodaraColors.success,
    warning: KodaraColors.warning,
    error: KodaraColors.error,
    successTint: KodaraColors.successTint,
    warningTint: KodaraColors.warningTint,
    errorTint: KodaraColors.errorTint,
    onInkSecondary: KodaraColors.onInkSecondary,
    onInkMuted: KodaraColors.onInkMuted,
  );

  static const KodaraThemeExtension dark = KodaraThemeExtension(
    accent: KodaraColorsDark.accent,
    accentDark: KodaraColorsDark.accentDark,
    accentTint: KodaraColorsDark.accentTint,
    accentTintStrong: KodaraColorsDark.accentTintStrong,
    ink: KodaraColorsDark.ink,
    background: KodaraColorsDark.background,
    surface: KodaraColorsDark.surface,
    textPrimary: KodaraColorsDark.textPrimary,
    textSecondary: KodaraColorsDark.textSecondary,
    border: KodaraColorsDark.border,
    success: KodaraColorsDark.success,
    warning: KodaraColorsDark.warning,
    error: KodaraColorsDark.error,
    successTint: KodaraColorsDark.successTint,
    warningTint: KodaraColorsDark.warningTint,
    errorTint: KodaraColorsDark.errorTint,
    onInkSecondary: KodaraColorsDark.onInkSecondary,
    onInkMuted: KodaraColorsDark.onInkMuted,
  );

  @override
  KodaraThemeExtension copyWith({
    Color? accent,
    Color? accentDark,
    Color? accentTint,
    Color? accentTintStrong,
    Color? ink,
    Color? background,
    Color? surface,
    Color? textPrimary,
    Color? textSecondary,
    Color? border,
    Color? success,
    Color? warning,
    Color? error,
    Color? successTint,
    Color? warningTint,
    Color? errorTint,
    Color? onInkSecondary,
    Color? onInkMuted,
  }) {
    return KodaraThemeExtension(
      accent: accent ?? this.accent,
      accentDark: accentDark ?? this.accentDark,
      accentTint: accentTint ?? this.accentTint,
      accentTintStrong: accentTintStrong ?? this.accentTintStrong,
      ink: ink ?? this.ink,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      border: border ?? this.border,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      successTint: successTint ?? this.successTint,
      warningTint: warningTint ?? this.warningTint,
      errorTint: errorTint ?? this.errorTint,
      onInkSecondary: onInkSecondary ?? this.onInkSecondary,
      onInkMuted: onInkMuted ?? this.onInkMuted,
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
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      border: Color.lerp(border, other.border, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      successTint: Color.lerp(successTint, other.successTint, t)!,
      warningTint: Color.lerp(warningTint, other.warningTint, t)!,
      errorTint: Color.lerp(errorTint, other.errorTint, t)!,
      onInkSecondary: Color.lerp(onInkSecondary, other.onInkSecondary, t)!,
      onInkMuted: Color.lerp(onInkMuted, other.onInkMuted, t)!,
    );
  }
}

/// Ergonomic accessor: `context.kodara.accent` etc.
extension KodaraThemeContext on BuildContext {
  KodaraThemeExtension get kodara =>
      Theme.of(this).extension<KodaraThemeExtension>() ??
      KodaraThemeExtension.light;
}

ThemeData buildKodaraTheme() =>
    _buildTheme(KodaraThemeExtension.light, Brightness.light);

ThemeData buildKodaraDarkTheme() =>
    _buildTheme(KodaraThemeExtension.dark, Brightness.dark);

ThemeData _buildTheme(KodaraThemeExtension p, Brightness brightness) {
  final colorScheme = ColorScheme(
    brightness: brightness,
    primary: p.accent,
    onPrimary: Colors.white,
    primaryContainer: p.accentTint,
    onPrimaryContainer: p.accentDark,
    secondary: p.ink,
    onSecondary: Colors.white,
    secondaryContainer: p.accentTint,
    onSecondaryContainer: p.ink,
    tertiary: p.accentDark,
    onTertiary: Colors.white,
    error: p.error,
    onError: Colors.white,
    errorContainer: p.errorTint,
    onErrorContainer: p.error,
    surface: p.surface,
    onSurface: p.textPrimary,
    surfaceContainerHighest: p.background,
    onSurfaceVariant: p.textSecondary,
    outline: p.border,
    outlineVariant: p.border,
    shadow: const Color(0x141C1917),
    scrim: const Color(0x801C1917),
    inverseSurface: p.ink,
    onInverseSurface: Colors.white,
    inversePrimary: p.accentTintStrong,
  );

  final textTheme = KodaraTypography.textTheme(p.textPrimary, p.textSecondary);

  const buttonTextStyle = TextStyle(
    fontFamily: kodaraFontFamily,
    fontWeight: FontWeight.w600,
    fontSize: KodaraTypography.base,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    fontFamily: kodaraFontFamily,
    scaffoldBackgroundColor: p.background,
    textTheme: textTheme,
    splashColor: p.accentDark.withValues(alpha: 0.12),
    highlightColor: p.accentDark.withValues(alpha: 0.08),
    appBarTheme: AppBarTheme(
      backgroundColor: p.background,
      foregroundColor: p.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.lg),
        side: BorderSide(color: p.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: BorderSide(color: p.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: BorderSide(color: p.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KodaraRadius.sm),
        borderSide: BorderSide(color: p.accent, width: 1.5),
      ),
      labelStyle:
          TextStyle(fontFamily: kodaraFontFamily, color: p.textSecondary),
      hintStyle:
          TextStyle(fontFamily: kodaraFontFamily, color: p.textSecondary),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.accent,
        foregroundColor: Colors.white,
        disabledBackgroundColor: p.accent.withValues(alpha: 0.4),
        minimumSize: const Size.fromHeight(52),
        shape: const StadiumBorder(),
        textStyle: buttonTextStyle,
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? p.accentDark.withValues(alpha: 0.16)
              : null,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.accent,
        side: BorderSide(color: p.border),
        minimumSize: const Size.fromHeight(52),
        shape: const StadiumBorder(),
        textStyle: buttonTextStyle,
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.pressed) ? p.accentTint : null,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.accent,
        textStyle: buttonTextStyle,
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.pressed) ? p.accentTint : null,
        ),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.accent,
      foregroundColor: Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.accentTint,
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontFamily: kodaraFontFamily,
          fontSize: KodaraTypography.xs,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
          color: selected ? p.accent : p.textSecondary,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? p.accent : p.textSecondary,
        );
      }),
    ),
    dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
    iconTheme: IconThemeData(color: p.textSecondary),
    listTileTheme: ListTileThemeData(
      iconColor: p.textSecondary,
      textColor: p.textPrimary,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.accent),
    dialogTheme: DialogThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KodaraRadius.lg)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
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
    extensions: [p],
  );
}
