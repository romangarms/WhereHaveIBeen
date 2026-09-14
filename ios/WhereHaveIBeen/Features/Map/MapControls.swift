import SwiftUI

struct ModePill: View {
    @Binding var selection: MapMode

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MapMode.allCases, id: \.self) { mode in
                Button {
                    selection = mode
                } label: {
                    Label(mode.title, systemImage: mode.symbol)
                        .font(.subheadline.weight(selection == mode ? .semibold : .medium))
                        .labelStyle(.titleAndIcon)
                        .padding(.horizontal, 14)
                        .frame(height: 36)
                        .foregroundStyle(selection == mode ? .white : .primary)
                        .background {
                            if selection == mode {
                                Capsule().fill(Color.accentColor)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .glassEffect(.regular, in: .capsule)
    }
}

struct GlassIconButton: View {
    var systemImage: String
    var accessibilityLabel: String
    var busy = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if busy {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: systemImage)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .frame(width: 40, height: 40)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(accessibilityLabel)
    }
}

struct FlightsChip: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            Label(isOn ? "Flights shown" : "Flights hidden", systemImage: "airplane")
                .font(.footnote.weight(.medium))
                .foregroundStyle(isOn ? Color.accentColor : .primary)
                .padding(.horizontal, 12)
                .frame(height: 32)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .capsule)
    }
}

struct StatusBanner: View {
    var model: MapScreenModel

    var body: some View {
        Group {
            switch model.phase {
            case .computing(let progress):
                ComputeStrip(progress: progress)
            case .loading where !model.hasData:
                row(icon: nil, text: "Loading…", progress: true)
            case .failed(let message):
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
                    Text(message).font(.footnote).lineLimit(2)
                    Spacer(minLength: 0)
                    Button("Retry") { model.reload(refresh: false) }
                        .font(.footnote.weight(.semibold))
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
                .glassEffect(.regular, in: .rect(cornerRadius: 14))
            default:
                if model.showingSavedData {
                    row(icon: "wifi.slash", text: "Showing saved data", progress: false)
                }
            }
        }
        .transition(.opacity)
    }

    private func row(icon: String?, text: String, progress: Bool) -> some View {
        HStack(spacing: 10) {
            if progress { ProgressView().controlSize(.small) }
            if let icon { Image(systemName: icon).foregroundStyle(.secondary) }
            Text(text).font(.footnote).lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .glassEffect(.regular, in: .rect(cornerRadius: 14))
    }
}

/// Mirrors the web app's progress strip: the server's stage and step count
/// while it computes, an indeterminate spinner until it reports any.
struct ComputeStrip: View {
    var progress: ComputeProgress?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if progress == nil { ProgressView().controlSize(.small) }
                Text(message).font(.footnote).lineLimit(2)
                Spacer(minLength: 0)
                if let progress, progress.total > 0 {
                    Text("\(progress.done) of \(progress.total) · \(progress.percent)%")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            if let progress {
                ProgressView(value: progress.fraction)
                    .tint(Color.accentColor)
                    .animation(.linear(duration: 0.32), value: progress.fraction)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .glassEffect(.regular, in: .rect(cornerRadius: 14))
    }

    private var message: String {
        if let progress { return "Computing on the server — \(progress.stageText)" }
        return "Computing on the server — the first load of a long history can take a minute"
    }
}

struct MapBottomCard<Accessory: View, Content: View>: View {
    var title: String
    var subtitle: String
    @ViewBuilder var accessory: () -> Accessory
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.secondary.opacity(0.35))
                .frame(width: 36, height: 5)
                .padding(.top, 6).padding(.bottom, 2)
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.title3.weight(.bold))
                    Text(subtitle).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                accessory()
            }
            .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 10)
            content()
                .padding(.horizontal, 16).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity)
        .background {
            // Extends under the floating tab bar so the map never peeks through below the card.
            UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16)
                .fill(Color(uiColor: .systemBackground))
                .shadow(color: .black.opacity(0.14), radius: 17, y: -6)
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

extension MapScreenModel {
    var freshnessText: String? {
        guard let computedAt else { return nil }
        return "Updated " + computedAt.formatted(.relative(presentation: .named))
    }
}
