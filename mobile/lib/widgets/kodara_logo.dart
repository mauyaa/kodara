import 'package:flutter/material.dart';

/// Kodara house mark, traced from the brand artwork — identical geometry to
/// the web SVG (512-unit viewBox: rounded roof stroke, arched window, door,
/// two rounded wings). Paints in a single [color] so it works on any surface:
/// ink on paper, white on the ink balance card.
class KodaraLogo extends StatelessWidget {
  const KodaraLogo({super.key, this.size = 24, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final resolved = color ?? Theme.of(context).colorScheme.onSurface;
    return CustomPaint(
      size: Size.square(size),
      painter: _KodaraMarkPainter(resolved),
    );
  }
}

/// Mark + wordmark lockup for app bars and auth headers.
class KodaraLockup extends StatelessWidget {
  const KodaraLockup({super.key, this.markSize = 22, this.color});

  final double markSize;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final resolved = color ?? Theme.of(context).colorScheme.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        KodaraLogo(size: markSize, color: resolved),
        const SizedBox(width: 8),
        Text(
          'Kodara',
          style: TextStyle(
            color: resolved,
            fontSize: markSize * 0.82,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            height: 1,
          ),
        ),
      ],
    );
  }
}

class _KodaraMarkPainter extends CustomPainter {
  const _KodaraMarkPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 512;
    canvas.scale(scale);

    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 72
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = color;

    // Roof chevron.
    final roof = Path()
      ..moveTo(66, 259)
      ..lineTo(256, 53)
      ..lineTo(446, 259);
    canvas.drawPath(roof, stroke);

    // Upper arch window.
    final window = Path()
      ..moveTo(209, 312)
      ..lineTo(209, 239)
      ..arcToPoint(const Offset(303, 239), radius: const Radius.circular(47))
      ..lineTo(303, 312)
      ..close();
    canvas.drawPath(window, fill);

    // Door.
    final door = Path()
      ..moveTo(211, 495)
      ..lineTo(211, 397)
      ..arcToPoint(const Offset(301, 397), radius: const Radius.circular(45))
      ..lineTo(301, 495)
      ..close();
    canvas.drawPath(door, fill);

    // Left wing.
    final leftWing = Path()
      ..moveTo(104, 495)
      ..arcToPoint(const Offset(104, 325), radius: const Radius.circular(85))
      ..lineTo(165, 325)
      ..arcToPoint(const Offset(189, 349), radius: const Radius.circular(24))
      ..lineTo(189, 455)
      ..arcToPoint(const Offset(149, 495), radius: const Radius.circular(40))
      ..close();
    canvas.drawPath(leftWing, fill);

    // Right wing.
    final rightWing = Path()
      ..moveTo(408, 325)
      ..arcToPoint(const Offset(408, 495), radius: const Radius.circular(85))
      ..lineTo(363, 495)
      ..arcToPoint(const Offset(323, 455), radius: const Radius.circular(40))
      ..lineTo(323, 349)
      ..arcToPoint(const Offset(347, 325), radius: const Radius.circular(24))
      ..close();
    canvas.drawPath(rightWing, fill);
  }

  @override
  bool shouldRepaint(_KodaraMarkPainter oldDelegate) =>
      oldDelegate.color != color;
}
